var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var crypto = require('crypto');

var User = db.Model.extend({
  tableName: 'userTable',

  initialize: function(){
    this.on('creating', this.hashPassword, this);
  },

  hashPassword: function(){
    return Promise.promisify(bcrypt.hash)(this.get('password'), null, null).bind(this).then(function(hash){
      this.set('password', hash);
    });
  }
});



module.exports = User;
