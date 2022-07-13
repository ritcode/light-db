# light-db

A lightweight database for small scale projects, simple to use and deploy, uses json file to store data.

Installation
------------

```sh-session
npm i light-db
```

Description
-------------
The package includes two types of storage, Database which stores data as key - value/object pair as well as wrapper to create Collections which stores data as array of documents.

Example Usage
-------------

### Database

```js
const { Database } = require('light-db');
const db = new Database();

db.set('activeUsers', 1000);
db.set('admin.username', 'ritcode');
db.set('admin.firstName', 'Ritesh')

db.has('admin'); // true
db.has('admin.username'); // true
db.has('admin.firstName'); // true
db.has('admin.age'); // false

db.remove('admin.firstName');
db.has('admin.firstName'); // false

db.get('admin.username'); // 'ritcode'
db.get('deveoper.name'); // undefined



db.toJSON(); // { activeUsers: 1000, admin: { username: 'ritcode' } }
```

### Collections

```js
const { Database } = require('light-db');
const db = new Database();

const Developers = db.createCollection('developers');

Developers.insert({ name: 'Ritesh', location: "India" });
Developers.insert({ name: 'Charles', age: 25, location:"Australia" });
Developers.insert({name: "Sia", location:"Poland", skills:["Nodejs", "react.js", "UI/UX"]});

Developers.update(
  d => d.age = 20,                    // what to update
  target => target.name === 'Sia'     // which documents to update
);

Developers.get(d => d.name === 'Ritesh'); // { name: 'Ritesh', location: "India" }
Developers.get(d => d.age > 18); // [{ name: 'Charles', age: 25, location:"Australia" }, { name: 'Sia', location:"Poland", skills:["Nodejs", "react.js", "UI/UX"] , age: 20 }]

Developers.delete( d => d.name == "Charles" ) // use with caution as it will delete all if no filter specified

```

Contribution
-------------

- You can open an issue or
- Create a valid pull request or
- Connect with me to have a discussion