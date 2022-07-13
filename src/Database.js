'use strict';

const FS = require('fs');
const path = require('path');
const crypto = require('crypto');
const Collection = require('./Collection');
const { isObject, isValidKey, validatePath, validateFolderPath, validateEncryptionKey} = require('./Helper/validation');
const DBFile = require("./Helper/FileAccess");


/**
 * @class Database
 * @classdesc Main class to create or perform transactions on db
 */
class Database {
  #config;
  #data;
  #DBF;

  constructor(config) {
    this.collections = [];
    this.#config = Object.assign({
      dataFile: './lightdb.json',
      collectionsFolder: './db-collections',
      autoSave: true,
      encryptionKey: null, // Must be of 32 characters (256 bits)
      tabSize: 2
    }, config);

    this.#data = {};
    try {
        this.#DBF = new DBFile(this.#config.dataFile);
        let valPath = validatePath(this.#config?.dataFile);
        switch(valPath) {
            case 0: // wrong file path
                throw new Error('Invalid file path for database. Provided path must lead to a .json file');
            case 1: // file not found
                this.#DBF.write(JSON.stringify({}));
                break;
            case 2: // No access to file
                throw new Error('The database file could not be accessed');
            default:
        }
        validateEncryptionKey(this.#config.encryptionKey);
        
    } catch(e) {
        console.error("Error in DB file : ",e.message);
    }
  }

  // Load db from existing or updated db file
  load() {
    this.#data = this.#DBF.read();
  }

  // clear all data from db
  clean() {
    this.#data = {};
    if (this.#config.autoSave) this.save();
  }

  // create new collection object and return
  createCollection(name, defaultValues={}) {
    try {
      const valPath = validateFolderPath(this.#config?.collectionsFolder);
      switch (valPath) {
        case 0:
          throw new Error('Invalid path for collection. Provided path must lead to a folder');
        case 1:
          FS.mkdirSync(this.#config.collectionsFolder);
          break;
        case 2:
          throw new Error('The provided folder could not be accessed');
        default:
          break;
      }

    } catch(e) {
      console.error("Error in collection folder : ",e.message);
    }

    if (!isValidKey(name)) throw new TypeError('The provided name is invalid');

    const newCollection = new Collection(name, { folderPath: this.#config.collectionsFolder, tabSize: this.#config.tabSize, autoSave: this.#config.autoSave }, defaultValues);
    if(this.collections.findIndex(c => c.name === name) !=-1) throw new Error(`Collection with name : ${name} already exists `)
    this.collections.push(newCollection);

    return newCollection;
  }

  // Delete a given key
  remove(key) {
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');

    const data = this.get(key);

    key.split('.').reduce((o, curr, i, arr) => {
      if (i === arr.length-1) delete o?.[curr];
      else return o?.[curr];
    }, this.#data);

    if (this.#config.autoSave) this.save();

    return !!data && this.get(key) === undefined;
  }

  // Delete a collection using its name
  deleteCollection(name) {
    if (!isValidKey(name)) throw new TypeError('The provided name is invalid');

    const collectionIndex = this.collections.findIndex(c => c.name === name);

    if (collectionIndex === -1) return false;

    this.#deleteFile(path.relative(process.cwd(), this.#config.collectionsFolder + '/' + name + '.json'));

    return this.collections.splice(collectionIndex, 1).length > 0;
  }

  // Get value of a specified key with optional boolean parameter for decryption
  get(key, decrypt=false) {
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');
    else if (typeof decrypt !== 'boolean') throw new TypeError('Parameter decrypt must be of type boolean');
    else if (decrypt && !this.#config.encryptionKey) throw new Error('Missing Encryption Key');

    const data = key.split('.').reduce((acc, curr) => acc?.[curr], this.#data);

    return !decrypt ? data : this.#decrypt(data);
  }

  // check if given key exists
  has(key) {
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');

    return this.get(key) !== undefined;
  }

  // Remove an element from array 
  removeFromArray(key, value) {
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');
    else if (value === undefined) throw new TypeError('A valid value must be provided');

    const oldArray = this.get(key) || [];

    if (!(Array.isArray(oldArray)) && oldArray !== undefined) throw new TypeError('The value of the provided key must be an array');

    this.set(key, oldArray.filter(v => v !== value));

    if (this.#config.autoSave) this.save();

    return this.get(key.split('.')[0]);
  }

  // Push new element in an array
  pushIntoArray(key, value) {
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');
    else if (value === undefined) throw new TypeError('A valid value must be provided');

    const oldArray = this.get(key) || [];

    if (!(Array.isArray(oldArray)) && oldArray !== undefined) throw new TypeError('The value of the provided key must be an array');

    oldArray.push(value);

    this.set(key, oldArray);

    if (this.#config.autoSave) this.save();

    return this.get(key.split('.')[0]);
  }

  // save data in db file
  save() {
    try {
      this.#DBF.write(JSON.stringify(this.#data, null, this.#config.tabSize));
    } catch (e) {
      if (e.code === 'EACCES') throw new Error('The database file could not be accessed');
    }
  }

  // Set value of a given key
  set(key, value, encrypt=false) {
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');
    else if (typeof encrypt !== 'boolean') throw new TypeError('Parameter encrypt must be of type boolean');
    else if (encrypt && !this.#config.encryptionKey) throw new Error('Missing Encryption Key');

    const keys = key.split('.');

    if (this.get(key) !== value) {
      const objectDotNotation = (object, Ks) => {
        if (Ks.length === 1)
          object[Ks[0]] = !encrypt ? value : this.#encrypt(value);
        else {
          if (!isObject(object[Ks[0]])) object[Ks[0]] = {};
          
          object[Ks[0]] = { ...object[Ks[0]] };
          objectDotNotation(object[Ks[0]], Ks.slice(1));
        }
      };

      objectDotNotation(this.#data, keys);

      if (this.#config.autoSave) this.save();
    }

    return this.get(keys[0]);
  }

  // Add some value to the value of a given key
  add(key, value) {
    return this.#addOrSubtract('add', key, value);
  }

  // Subtract some value from the value of a given key
  subtract(key, value) {
    return this.#addOrSubtract('subtract', key, value);
  }

  // return whole db
  toJSON() {
    return JSON.parse(JSON.stringify(this.#data));
  }



  /* ... Private Methods ... */

  #addOrSubtract(operation, key, value) {
    if (value === undefined || value === Infinity) throw new TypeError('A valid value must be provided');
    if (!isValidKey(key)) throw new TypeError('The provided key is invalid');

    const existingData = this.get(key) || 0;

    if (typeof value !== 'number') throw new TypeError('The provided value must be a number');
    else if (['undefined', 'number'].every(t => typeof existingData !== t)) throw new TypeError('The value of the provided key must be a number');

    this.set(key, operation === 'add' ? existingData + value : existingData - value);

    if (this.#config.autoSave) this.save();

    return this.get(key.split('.')[0]);
  }

  // @vlucas, https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
  #decrypt(string) {
    try {
      if (typeof string !== 'string') throw new TypeError('The provided value must be a string to be decrypted');
      else if (string.split(':').length !== 2 || string.includes(' ')) throw new TypeError('The provided value could not be decrypted as it was not encrypted before');
      const stringParts = string.split(':');
      const iv = Buffer.from(stringParts.shift(), 'hex');
      const encryptedText = Buffer.from(stringParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(this.#config.encryptionKey), iv);
      const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

      return decrypted.toString();
    } catch (e) {
      throw new Error('An error has occurred while decrypting a value');
    }
  }

  #deleteFile(path) {
    try {
      FS.unlinkSync(path);
    } catch(e) {
      throw new Error('An error has occurred while deleting the file ' + path + ': ' + e);
    }
  }

  // @vlucas, https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
  #encrypt(string) {
    try {
      if (typeof string !== 'string') throw new TypeError('The provided value must be a string to be encrypted');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(this.#config.encryptionKey), iv);
      const encrypted = Buffer.concat([cipher.update(string), cipher.final()]);

      return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
      if (e.message === 'The provided value must be a string to be encrypted') throw e;
      else throw new Error('An error has occurred while encrypting a value');
    }
  }


}

module.exports = Database;