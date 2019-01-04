/*
  Custom Errors
*/

function HitRateReached (message) {
  this.name = 'HitRateReached';
  this.message = message;
}

function TimeElapsed (message) {
  this.name = 'TimeElapsed';
  this.message = message;
}

function UnexpectedError (message) {
  this.name = 'UnexpectedError';
  this.message = message;
}

function GooglePlusApiNotEnabled (message) {
  this.name = 'GooglePlusApiNotEnabled';
  this.message = message;
}

HitRateReached.prototype = Object.create(Error.prototype);
TimeElapsed.prototype = Object.create(Error.prototype);
UnexpectedError.prototype = Object.create(Error.prototype);
GooglePlusApiNotEnabled.prototype = Object.create(Error.prototype);

HitRateReached.prototype.contructor = HitRateReached;
TimeElapsed.prototype.contructor = TimeElapsed;
UnexpectedError.prototype.constructor = UnexpectedError;
GooglePlusApiNotEnabled.prototype.constructor = GooglePlusApiNotEnabled;
