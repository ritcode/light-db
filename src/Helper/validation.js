'use strict';

const path = require('path');
const FS = require('fs');

/** isObject - Check if given parameter is an Object
 * 
 * @param {*} obj 
 * @returns Boolean
 */
function isObject(obj) {
  const stringified = JSON.stringify(obj);
  return !!(stringified?.startsWith('{') && stringified?.endsWith('}'));
}

/** isValidKey - Check if given string is a valid key
 * 
 * @param {*} key 
 * @returns Boolean
 */
function isValidKey(key) {
  return !(typeof key !== 'string' || !key || /(^\.)|(\.\.)|(\.$)/g.test(key));
}

/** validatePath - Validate given string of db file path
 * 
 *  0 => Invalid File Format
 * 
 *  1 => File not Found
 * 
 *  2 => Permission Denied
 * 
 *  3 => Success
 * 
 * @param {*} dataFile 
 * @returns Integer
 */
function validatePath(dataFile) {
    if (path.extname(dataFile) !== '.json') return 0;

    try {
      FS.lstatSync(dataFile);
    } catch (e) {
      if (e.code === 'ENOENT') return 1
      else if (e.code === 'EACCES')  return 2;
    }
    return 3;
}

/** validateFolderPath - Validate given string of as folder path
 * 
 *  0 => Invalid Folder Path
 * 
 *  1 => No Path found
 * 
 *  2 => Permission Denied
 * 
 *  3 => Success
 * 
 * @param {*} folderPath 
 * @returns Integer
 */
function validateFolderPath(folderPath) {
  try {
    if (!FS.statSync(folderPath).isDirectory()) return 0;
  } catch (e) {
    if (e.code === 'ENOENT') return 1;
    else if (e.code === 'EACCES') return 2;
    else throw new Error(e);
  }
  return 3;
}

/** Validate encryption key 
 * 
 * @param {*} key 
 */
function validateEncryptionKey(key) {
    if (key !== null) {
      if (typeof key !== 'string') throw new TypeError('The Encryption Key must be a string');
      else if (key.length !== 32) throw new Error('The Encryption Key must have a length of 32 characters');
    }
  }

function isString(name) {
    if (typeof name !== 'string') throw new TypeError('The name for the collection must be a string');
    else if (!name.length) throw new TypeError('The provided name for the collection is invalid');

    return true;
  }


module.exports = { isObject, isValidKey, validatePath,validateFolderPath, validateEncryptionKey, isString};