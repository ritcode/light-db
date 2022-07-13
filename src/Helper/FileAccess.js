const fs = require('fs');
const path = require('path');


class DBFile {
  #filename;
  #tempFilename;
  #locked = false
  #prev = null;
  #next = null;
  #nextPromise = null;
  #nextData = null;

  // File is locked, add data for later
  #add(data) {
    // Only keep most recent data
    this.#nextData = data

    // Create a singleton promise to resolve all next promises once next data is written
    this.#nextPromise ||= new Promise((resolve, reject) => {
      this.#next = [resolve, reject]
    })

    // Return a promise that will resolve at the same time as next promise
    return new Promise((resolve, reject) => {
      this.#nextPromise?.then(resolve).catch(reject)
    })
  }

  // File isn't locked, write data
  async #write(data) {
    // Lock file
    this.#locked = true
    try {
      // Atomic write
      await fs.promises.writeFile(this.#tempFilename, data, 'utf-8')
      await fs.promises.rename(this.#tempFilename, this.#filename)

      // Call resolve
      this.#prev?.[0]()
    } catch (err) {
      // Call reject
      this.#prev?.[1](err)
      throw err
    } finally {
      // Unlock file
      this.#locked = false

      this.#prev = this.#next
      this.#next = this.#nextPromise = null

      if (this.#nextData !== null) {
        const nextData = this.#nextData
        this.#nextData = null
        await this.write(nextData)
      }
    }
  }

  constructor(filename) {
    this.#filename = filename
    this.#tempFilename = this.getTempFilename(filename)
  }

  // write file asychronously
  async write(data) {
    return this.#locked ? this.#add(data) : this.#write(data)
  }

  // Read file
  read(arr = false) {
    try {
      return JSON.parse(fs.readFileSync(this.#filename, 'utf8'))
      // return  await JSON.parse(fs.promises.readFile(this.#filename, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') {
        if(arr) {
          this.write("[]");
          return [];
        }
        else {
          this.write('{}');
          return {};
        }
      }
      else if (e.code === 'EACCES') throw new Error('The file could not be accessed');
    }
  }
  
  getTempFilename(file) {
    return path.join(path.dirname(file), '.' + path.basename(file) + '.tmp')
  }
}


module.exports = DBFile
