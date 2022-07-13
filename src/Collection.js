'use strict';

const FS = require('fs');
const DBFile = require('./Helper/FileAccess');
const { isObject, isString } = require('./Helper/validation');

/**
 * @class Collection
 * @classdesc Wrapper class to contain collections 
 */
class Collection {
  #config;
  #data;
  #defaultValues;
  #CollectionFile;

  constructor(name, config, defaultValues) {
    if(isString(name)) this.name = name;
    if (!isObject(defaultValues)) throw new TypeError('The defaultValues option must be an object');
    else this.#defaultValues = defaultValues;

    this.#config = config;
    this.#CollectionFile = new DBFile(`${this.#config.folderPath}/${this.name}.json`);

    this.#data = this.#CollectionFile.read(true) || [];
    this.entries = this.#data.length;
  }

  
  // Insert a new document
  insert(data) {
    this.#checkEntry(data);

    this.#data.push(data);

    if (this.#config.autoSave) this.save();

    return { ...Object.fromEntries(Object.entries(this.#defaultValues).filter(([k]) => !Object.keys(this.#defaultValues).includes(k))), ...data };
  }


  // Get a document based on filter, returns all if not filter specified
  get(filter=(()=>true)) {
    if (typeof filter !== 'function') throw new TypeError('The provided parameter must be a function');

    const filtered = this.#data.filter(filter);

    return filtered.length === 1 && !!arguments[0] ? filtered[0] : !filtered.length ? null : filtered;
  }

  // check if a document exists based on filter
  has(filter) {
    if (typeof filter !== 'function') throw new TypeError('The provided parameter must be a function');

    const data = this.get(filter);

    return !!data || data?.length > 0;
  }

  // Get a random document from collection
  getRandomDocument(amount=1) {
    if (typeof amount !== 'number' || amount <= 0) throw new TypeError('The amount of entries must be a number bigger than 0 (zero)');
    else if (amount > this.#data.length) throw new RangeError('The provided amount of entries exceeds the total amount of entries from the collection');

    const randomS = this.#data.sort(() => 0.5 - Math.random()).slice(0, amount);

    return randomS.length === 1 ? randomS[0] : randomS;
  }

  // delete document/s based on provided filter, deletes all if no filter specified
  delete(filter=(()=>true)) {
    if (typeof filter !== 'function') throw new TypeError('The provided parameter must be a function');

    const filtered = this.#data.filter(filter);

    this.#data = this.#data.filter(d => !filtered.includes(d));

    if (this.#config.autoSave) this.save();

    return this.#data;
  }

  // save data to collection file
  async save() {
    this.entries = this.#data.length;

    try {
      await this.#CollectionFile.write(JSON.stringify(this.#data, null, this.#config.tabSize));
    } catch (e) {
      if (e.code === 'EACCES') throw new Error('The collection\'s file could not be accessed');
    }
  }

  // update document based on two filter. first one for what to update and second one to select which documents to update
  update(updateCallback, filter=(()=>true)) {
    if (typeof updateCallback !== 'function') throw new TypeError('The provided parameter must be a function');
    if (typeof filter !== 'function') throw new TypeError('The provided parameter must be a function');

    const newData = this.#data.filter(filter);

    for (let i = 0; i < newData.length; i++)
      updateCallback(newData[i]);

    if (this.#config.autoSave) this.save();

    return this.#data;
  }



  /* ==================== Private Methods ==================== */


  #checkEntry(entry) {
    if (!isObject(entry)) throw new TypeError('Provided entry must be an object');

    const defaults = Object.entries(this.#defaultValues);

    for (let i = 0; i < defaults.length; i++)
      if (!entry.hasOwnProperty(defaults[i][0]))
        if (defaults[i][0].startsWith('$')) {
          const propertyName = defaults[i][0].slice(1);
          const validEntries = this.#data.filter(e => e.hasOwnProperty(propertyName));
          const value = validEntries[validEntries.length-1]?.[propertyName];

          entry[propertyName] = isNaN(value) ? defaults[i][1] : value + 1;
        }
        else
          entry[defaults[i][0]] = defaults[i][1];
  }

}

module.exports = Collection;
