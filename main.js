(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
/**
 * lodash 4.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keysIn = require('lodash.keysin'),
    rest = require('lodash.rest');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if ((!eq(objValue, value) ||
        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object) {
  return copyObjectWith(source, props, object);
}

/**
 * This function is like `copyObject` except that it accepts a function to
 * customize copied values.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObjectWith(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : source[key];

    assignValue(object, key, newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return rest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = typeof customizer == 'function'
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * This method is like `_.assign` except that it iterates over own and
 * inherited source properties.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @example
 *
 * function Foo() {
 *   this.b = 2;
 * }
 *
 * function Bar() {
 *   this.d = 4;
 * }
 *
 * Foo.prototype.c = 3;
 * Bar.prototype.e = 5;
 *
 * _.assignIn({ 'a': 1 }, new Foo, new Bar);
 * // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5 }
 */
var assignIn = createAssigner(function(object, source) {
  copyObject(source, keysIn(source), object);
});

module.exports = assignIn;

},{"lodash.keysin":3,"lodash.rest":5}],3:[function(require,module,exports){
/**
 * lodash 4.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `iterator` to an array.
 *
 * @private
 * @param {Object} iterator The iterator to convert.
 * @returns {Array} Returns the converted array.
 */
function iteratorToArray(iterator) {
  var data,
      result = [];

  while (!(data = iterator.next()).done) {
    result.push(data.value);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Reflect = root.Reflect,
    enumerate = Reflect ? Reflect.enumerate : undefined,
    propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.keysIn` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  object = object == null ? object : Object(object);

  var result = [];
  for (var key in object) {
    result.push(key);
  }
  return result;
}

// Fallback for IE < 9 with es6-shim.
if (enumerate && !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf')) {
  baseKeysIn = function(object) {
    return iteratorToArray(enumerate(object));
  };
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  var index = -1,
      isProto = isPrototype(object),
      props = baseKeysIn(object),
      propsLength = props.length,
      indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  while (++index < propsLength) {
    var key = props[index];
    if (!(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"lodash._root":4}],4:[function(require,module,exports){
(function (global){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

module.exports = root;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],5:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://mdn.io/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.rest(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function rest(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : toInteger(start), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, array);
      case 1: return func.call(this, args[0], array);
      case 2: return func.call(this, args[0], args[1], array);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = rest;

},{}],6:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isFunction;

},{}],7:[function(require,module,exports){
/**
 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var toString = require('lodash.tostring');

/** Used to generate unique IDs. */
var idCounter = 0;

/**
 * Generates a unique ID. If `prefix` is given the ID is appended to it.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {string} [prefix] The value to prefix the ID with.
 * @returns {string} Returns the unique ID.
 * @example
 *
 * _.uniqueId('contact_');
 * // => 'contact_104'
 *
 * _.uniqueId();
 * // => '105'
 */
function uniqueId(prefix) {
  var id = ++idCounter;
  return toString(prefix) + id;
}

module.exports = uniqueId;

},{"lodash.tostring":8}],8:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = Symbol ? symbolProto.toString : undefined;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (isSymbol(value)) {
    return Symbol ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toString;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){
/* jshint browser: true */

(function () {

// The properties that we copy into a mirrored div.
// Note that some browsers, such as Firefox,
// do not concatenate properties, i.e. padding-top, bottom etc. -> padding,
// so we have to do every single property specifically.
var properties = [
  'direction',  // RTL support
  'boxSizing',
  'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  'height',
  'overflowX',
  'overflowY',  // copy the scrollbar for IE

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',  // might not make a difference, but better be safe

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  'MozTabSize'

];

var isBrowser = (typeof window !== 'undefined');
var isFirefox = (isBrowser && window.mozInnerScreenX != null);

function getCaretCoordinates(element, position, options) {
  if(!isBrowser) {
    throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
  }

  var debug = options && options.debug || false;
  if (debug) {
    var el = document.querySelector('#input-textarea-caret-position-mirror-div');
    if ( el ) { el.parentNode.removeChild(el); }
  }

  // mirrored div
  var div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  var style = div.style;
  var computed = window.getComputedStyle? getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9

  // default textarea styles
  style.whiteSpace = 'pre-wrap';
  if (element.nodeName !== 'INPUT')
    style.wordWrap = 'break-word';  // only for textarea-s

  // position off-screen
  style.position = 'absolute';  // required to return coordinates properly
  if (!debug)
    style.visibility = 'hidden';  // not 'display: none' because we want rendering

  // transfer the element's properties to the div
  properties.forEach(function (prop) {
    style[prop] = computed[prop];
  });

  if (isFirefox) {
    // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
    if (element.scrollHeight > parseInt(computed.height))
      style.overflowY = 'scroll';
  } else {
    style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
  }

  div.textContent = element.value.substring(0, position);
  // the second special handling for input type="text" vs textarea: spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
  if (element.nodeName === 'INPUT')
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');

  var span = document.createElement('span');
  // Wrapping must be replicated *exactly*, including when a long word gets
  // onto the next line, with whitespace at the end of the line before (#7).
  // The  *only* reliable way to do that is to copy the *entire* rest of the
  // textarea's content into the <span> created at the caret position.
  // for inputs, just '.' would be enough, but why bother?
  span.textContent = element.value.substring(position) || '.';  // || because a completely empty faux span doesn't render at all
  div.appendChild(span);

  var coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth'])
  };

  if (debug) {
    span.style.backgroundColor = '#aaa';
  } else {
    document.body.removeChild(div);
  }

  return coordinates;
}

if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
  module.exports = getCaretCoordinates;
} else if(isBrowser){
  window.getCaretCoordinates = getCaretCoordinates;
}

}());

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CALLBACK_METHODS = ['handleQueryResult'];

/**
 * @extends EventEmitter
 */

var Completer = function (_EventEmitter) {
  _inherits(Completer, _EventEmitter);

  function Completer() {
    _classCallCheck(this, Completer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Completer).call(this));

    _this.strategies = [];

    // Bind callback methods
    CALLBACK_METHODS.forEach(function (name) {
      _this[name] = _this[name].bind(_this);
    });
    return _this;
  }

  /**
   * Register a strategy to the completer.
   *
   * @public
   * @param {Strategy} strategy
   * @returns {this}
   */


  _createClass(Completer, [{
    key: 'registerStrategy',
    value: function registerStrategy(strategy) {
      this.strategies.push(strategy);
      return this;
    }

    /**
     * @public
     * @param {string} text - Head to input cursor.
     * @fires Completer#hit
     */

  }, {
    key: 'run',
    value: function run(text) {
      var query = this.extractQuery(text);
      if (query) {
        query.execute(this.handleQueryResult);
      } else {
        this.handleQueryResult([]);
      }
    }

    /**
     * Find a query, which matches to the given text.
     *
     * @private
     * @param {string} text - Head to input cursor.
     * @returns {?Query}
     */

  }, {
    key: 'extractQuery',
    value: function extractQuery(text) {
      var i;
      for (i = 0; i < this.strategies.length; i++) {
        var query = this.strategies[i].buildQuery(text);
        if (query) {
          return query;
        }
      }
      return null;
    }

    /**
     * Callbacked by Query#execute.
     *
     * @private
     * @param {SearchResult[]} searchResults
     */

  }, {
    key: 'handleQueryResult',
    value: function handleQueryResult(searchResults) {
      /**
       * @event Completer#hit
       * @type {object}
       * @prop {SearchResult[]} searchResults
       */
      this.emit('hit', { searchResults: searchResults });
    }
  }]);

  return Completer;
}(_events.EventEmitter);

exports.default = Completer;

},{"events":1}],11:[function(require,module,exports){
'use strict';

var _textcomplete = require('../textcomplete');

var _textcomplete2 = _interopRequireDefault(_textcomplete);

var _textarea = require('../textarea');

var _textarea2 = _interopRequireDefault(_textarea);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var textarea = new _textarea2.default(document.getElementById('textarea1'));
var textcomplete = new _textcomplete2.default(textarea);
textcomplete.register([{
  match: /(^|\s)(\w+)$/,
  search: function search(term, callback) {
    callback([term.toUpperCase(), term.toLowerCase()]);
  },
  replace: function replace(value) {
    return '$1' + value + ' ';
  }
}]);

},{"../textarea":18,"../textcomplete":19}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash.uniqueid');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var INACTIVE_CLASS_NAME = 'textcomplete-item';
var ACTIVE_CLASS_NAME = INACTIVE_CLASS_NAME + ' active';
var CALLBACK_METHODS = ['onClick'];

/**
 * Encapsulate an item of dropdown.
 */

var DropdownItem = function () {
  /**
   * @param {SearchResult} searchResult
   */

  function DropdownItem(searchResult) {
    var _this = this;

    _classCallCheck(this, DropdownItem);

    this.searchResult = searchResult;
    this.id = (0, _lodash2.default)('dropdown-item-');
    this.active = false;

    CALLBACK_METHODS.forEach(function (name) {
      _this[name] = _this[name].bind(_this);
    });
  }

  /**
   * @public
   * @returns {HTMLLIElement}
   */


  _createClass(DropdownItem, [{
    key: 'finalize',


    /**
     * Try to free resources and perform other cleanup operations.
     *
     * @public
     */
    value: function finalize() {
      this._el.removeEventListener('mousedown', this.onClick, false);
      this._el.removeEventListener('touchstart', this.onClick, false);
      // This element has already been removed by `Dropdown#clear`.
      this._el = null;
    }

    /**
     * Callbacked when it is appended to a dropdown.
     *
     * @public
     * @param {Dropdown} dropdown
     * @see Dropdown#append
     */

  }, {
    key: 'appended',
    value: function appended(dropdown) {
      this.dropdown = dropdown;
      this.siblings = dropdown.items;
      this.index = this.siblings.length - 1;
      if (this.index === 0) {
        this.activate();
      }
    }

    /**
     * @public
     * @returns {this}
     */

  }, {
    key: 'activate',
    value: function activate() {
      if (!this.active) {
        this.active = true;
        this.el.className = ACTIVE_CLASS_NAME;
      }
      return this;
    }

    /**
     * @public
     * @returns {this}
     */

  }, {
    key: 'deactivate',
    value: function deactivate() {
      if (this.active) {
        this.active = false;
        this.el.className = INACTIVE_CLASS_NAME;
      }
      return this;
    }

    /**
     * Get the next sibling.
     *
     * @public
     * @returns {DropdownItem}
     */

  }, {
    key: 'onClick',


    /**
     * @private
     * @param {MouseEvent} e
     */
    value: function onClick(e) {
      e.preventDefault(); // Prevent blur event
      this.dropdown.select(this);
    }
  }, {
    key: 'el',
    get: function get() {
      if (!this._el) {
        var li = document.createElement('li');
        li.id = this.id;
        li.className = this.active ? ACTIVE_CLASS_NAME : INACTIVE_CLASS_NAME;
        var a = document.createElement('a');
        a.innerHTML = this.searchResult.render();
        li.appendChild(a);
        this._el = li;
        li.addEventListener('mousedown', this.onClick);
        li.addEventListener('touchstart', this.onClick);
      }
      return this._el;
    }
  }, {
    key: 'next',
    get: function get() {
      var nextIndex = this.index === this.siblings.length - 1 ? 0 : this.index + 1;
      return this.siblings[nextIndex];
    }

    /**
     * Get the previous sibling.
     *
     * @public
     * @returns {DropdownItem}
     */

  }, {
    key: 'prev',
    get: function get() {
      var prevIndex = (this.index === 0 ? this.siblings.length : this.index) - 1;
      return this.siblings[prevIndex];
    }
  }]);

  return DropdownItem;
}();

exports.default = DropdownItem;

},{"lodash.uniqueid":7}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dropdownItem = require('./dropdown-item');

var _dropdownItem2 = _interopRequireDefault(_dropdownItem);

var _lodash = require('lodash.assignin');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.uniqueid');

var _lodash4 = _interopRequireDefault(_lodash3);

var _events = require('events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Encapsulate a dropdown view.
 *
 * @prop {boolean} shown - Whether the #el is shown or not.
 * @prop {DropdownItem[]} items - The array of rendered dropdown items.
 * @extends EventEmitter
 */

var Dropdown = function (_EventEmitter) {
  _inherits(Dropdown, _EventEmitter);

  _createClass(Dropdown, null, [{
    key: 'createElement',

    /**
     * @returns {HTMLUListElement}
     */
    value: function createElement() {
      var el = document.createElement('ul');
      el.className = 'dropdown-menu textcomplete-dropdown';
      el.id = (0, _lodash4.default)('textcomplete-dropdown-');
      (0, _lodash2.default)(el.style, {
        display: 'none',
        left: 0,
        position: 'absolute',
        zIndex: 10000
      });
      document.body.appendChild(el);
      return el;
    }

    /**
     * @param {?string} className - The class attribute of the el.
     */

  }]);

  function Dropdown(_ref) {
    var className = _ref.className;

    _classCallCheck(this, Dropdown);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Dropdown).call(this));

    _this.shown = false;
    _this.items = [];
    if (className) {
      _this.el.className = className;
    }
    return _this;
  }

  /**
   * @private
   * @returns {HTMLUListElement}
   */


  _createClass(Dropdown, [{
    key: 'render',


    /**
     * Render the given data as dropdown items.
     *
     * @param {SearchResult[]} searchResults
     * @param {{top: number, left: number}} cursorOffset
     * @returns {this}
     */
    value: function render(searchResults, cursorOffset) {
      this.clear().append(searchResults.map(function (searchResult) {
        return new _dropdownItem2.default(searchResult);
      }));
      return this.items.length > 0 ? this.setOffset(cursorOffset).show() : this.hide();
    }

    /**
     * Hide the dropdown then sweep out items.
     *
     * @returns {this}
     */

  }, {
    key: 'deactivate',
    value: function deactivate() {
      return this.hide().clear();
    }

    /**
     * @param {DropdownItem} dropdownItem
     * @returns {this}
     * @fires Dropdown#select
     */

  }, {
    key: 'select',
    value: function select(dropdownItem) {
      /**
        * @event Dropdown#select
        * @type {object}
        * @prop {SearchResult} searchResult
        */
      this.emit('select', { searchResult: dropdownItem.searchResult });
      return this.deactivate();
    }

    /**
     * @param {function} callback
     * @returns {this}
     * @fires Dropdown#select
     */

  }, {
    key: 'selectActiveItem',
    value: function selectActiveItem(callback) {
      if (this.shown) {
        var activeItem = this.getActiveItem();
        if (activeItem) {
          this.select(activeItem);
          callback(activeItem);
        }
      }
      return this;
    }

    /**
     * @param {function} callback
     * @returns {this}
     */

  }, {
    key: 'up',
    value: function up(callback) {
      return this.moveActiveItem('prev', callback);
    }

    /**
     * @param {function} callback
     * @returns {this}
     */

  }, {
    key: 'down',
    value: function down(callback) {
      return this.moveActiveItem('next', callback);
    }

    /**
     * Add items to dropdown.
     *
     * @private
     * @param {DropdownItem[]} items
     * @returns {this};
     */

  }, {
    key: 'append',
    value: function append(items) {
      var _this2 = this;

      var fragment = document.createDocumentFragment();
      items.forEach(function (item) {
        _this2.items.push(item);
        item.appended(_this2);
        fragment.appendChild(item.el);
      });
      this.el.appendChild(fragment);
      return this;
    }

    /**
     * @private
     * @param {{top: number, left: number}} cursorOffset
     * @returns {this}
     */

  }, {
    key: 'setOffset',
    value: function setOffset(cursorOffset) {
      this.el.style.top = cursorOffset.top + 'px';
      this.el.style.left = cursorOffset.left + 'px';
      return this;
    }

    /**
     * Show the element.
     *
     * @private
     * @returns {this}
     */

  }, {
    key: 'show',
    value: function show() {
      if (!this.shown) {
        this.el.style.display = 'block';
        this.shown = true;
      }
      return this;
    }

    /**
     * Hide the element.
     *
     * @private
     * @returns {this}
     */

  }, {
    key: 'hide',
    value: function hide() {
      if (this.shown) {
        this.el.style.display = 'none';
        this.shown = false;
      }
      return this;
    }

    /**
     * Clear search results.
     *
     * @private
     * @returns {this}
     */

  }, {
    key: 'clear',
    value: function clear() {
      this.el.innerHTML = '';
      this.items.forEach(function (item) {
        item.finalize();
      });
      this.items = [];
      return this;
    }

    /**
     * Retrieve the active item.
     *
     * @private
     * @returns {DropdownItem|undefined}
     */

  }, {
    key: 'getActiveItem',
    value: function getActiveItem() {
      return this.items.find(function (item) {
        return item.active;
      });
    }

    /**
     * @private
     * @param {string} name
     * @param {function} callback
     * @returns {this}
     */

  }, {
    key: 'moveActiveItem',
    value: function moveActiveItem(name, callback) {
      if (this.shown) {
        var activeItem = this.getActiveItem();
        if (activeItem) {
          activeItem.deactivate();
          callback(activeItem[name].activate());
        }
      }
      return this;
    }
  }, {
    key: 'el',
    get: function get() {
      this._el || (this._el = Dropdown.createElement());
      return this._el;
    }

    /**
     * @returns {number}
     */

  }, {
    key: 'length',
    get: function get() {
      return this.items.length;
    }
  }]);

  return Dropdown;
}(_events.EventEmitter);

exports.default = Dropdown;

},{"./dropdown-item":12,"events":1,"lodash.assignin":2,"lodash.uniqueid":7}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DOWN = exports.UP = exports.ENTER = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ENTER = exports.ENTER = 0;
var UP = exports.UP = 1;
var DOWN = exports.DOWN = 2;

/**
 * Abstract class representing a editor target.
 *
 * @abstract
 * @extends EventEmitter
 */

var Editor = function (_EventEmitter) {
  _inherits(Editor, _EventEmitter);

  function Editor() {
    _classCallCheck(this, Editor);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Editor).apply(this, arguments));
  }

  _createClass(Editor, [{
    key: 'applySearchResult',

    /**
     * @event Editor#move
     * @type {object}
     * @prop {number} code
     * @prop {function} callback
     */

    /**
     * @event Editor#change
     * @type {object}
     * @prop {string} beforeCursor
     */

    /**
     * @event Editor#blur
     */

    /**
     * It is called when a search result is selected by a user.
     *
     * @param {SearchResult} _searchResult
     */
    value: function applySearchResult(_searchResult) {
      throw new Error('Not implemented.');
    }

    /**
     * The input cursor's absolute coordinates from the window's left
     * top corner. It is intended to be overridden by sub classes.
     *
     * @type {object}
     * @prop {number} top
     * @prop {number} left
     */

  }, {
    key: 'cursorOffset',
    get: function get() {
      throw new Error('Not implemented.');
    }
  }]);

  return Editor;
}(_events.EventEmitter);

exports.default = Editor;

},{"events":1}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _searchResult = require('./search-result');

var _searchResult2 = _interopRequireDefault(_searchResult);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Encapsulate matching condition between a Strategy and current editor's value.
 */

var Query = function () {
  /**
   * @param {Strategy} strategy
   * @param {string} term
   * @param {string[]} match
   */

  function Query(strategy, term, match) {
    _classCallCheck(this, Query);

    this.strategy = strategy;
    this.term = term;
    this.match = match;
  }

  /**
   * Invoke search strategy and callback the given function.
   *
   * @public
   * @param {function} callback
   */


  _createClass(Query, [{
    key: 'execute',
    value: function execute(callback) {
      var _this = this;

      this.strategy.search(this.term, function (results) {
        callback(results.map(function (result) {
          return new _searchResult2.default(result, _this.term, _this.strategy);
        }));
      }, this.match);
    }
  }]);

  return Query;
}();

exports.default = Query;

},{"./search-result":16}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SearchResult = function () {
  /**
   * @param {object} data - An element of array callbacked by search function.
   * @param {string} term
   * @param {Strategy} strategy
   */

  function SearchResult(data, term, strategy) {
    _classCallCheck(this, SearchResult);

    this.data = data;
    this.term = term;
    this.strategy = strategy;
  }

  /**
   * @param {string} beforeCursor
   * @param {string} afterCursor
   * @returns {string[]|undefined}
   */


  _createClass(SearchResult, [{
    key: "replace",
    value: function replace(beforeCursor, afterCursor) {
      var replacement = this.strategy.replace(this.data);
      if (replacement != null) {
        if (Array.isArray(replacement)) {
          afterCursor = replacement[1] + afterCursor;
          replacement = replacement[0];
        }
        return [beforeCursor.replace(this.strategy.match, replacement), afterCursor];
      }
    }

    /**
     * @returns {string}
     */

  }, {
    key: "render",
    value: function render() {
      return this.strategy.template(this.data, this.term);
    }
  }]);

  return SearchResult;
}();

exports.default = SearchResult;

},{}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _query = require('./query');

var _query2 = _interopRequireDefault(_query);

var _lodash = require('lodash.isfunction');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Encapsulate a single strategy.
 */

var Strategy = function () {
  /**
   * @param {object} props - Attributes of the strategy.
   */

  function Strategy(props) {
    _classCallCheck(this, Strategy);

    this.props = props;
    this.props.template || (this.props.template = function (value) {
      return value;
    });
    this.cache = props.cache ? {} : null;
  }

  /**
   * Build a Query object by the given string if this matches to the string.
   *
   * @param {string} text - Head to input cursor.
   * @returns {?Query}
   */


  _createClass(Strategy, [{
    key: 'buildQuery',
    value: function buildQuery(text) {
      var match = text.match(this.getMatchRegexp(text));
      return match ? new _query2.default(this, match[this.index], match) : null;
    }

    /**
     * @param {string} term
     * @param {function} callback
     * @param {string[]} match
     */

  }, {
    key: 'search',
    value: function search(term, callback, match) {
      if (this.cache) {
        this.searchWithCache(term, callback, match);
      } else {
        this.props.search(term, callback, match);
      }
    }

    /**
     * @param {object} data - An element of array callbacked by search function.
     * @returns {string[]|string|null}
     */

  }, {
    key: 'replace',
    value: function replace(data) {
      return this.props.replace(data);
    }

    /**
     * @private
     * @param {string} term
     * @param {function} callback
     * @param {string[]} match
     */

  }, {
    key: 'searchWithCache',
    value: function searchWithCache(term, callback, match) {
      var _this = this;

      var cache = this.cache[term];
      if (cache) {
        callback(cache);
      } else {
        this.props.search(term, function (results) {
          _this.cache[term] = results;
          callback(results);
        }, match);
      }
    }

    /**
     * @private
     * @param {string} text
     * @returns {RegExp}
     */

  }, {
    key: 'getMatchRegexp',
    value: function getMatchRegexp(text) {
      return (0, _lodash2.default)(this.match) ? this.match(text) : this.match;
    }

    /**
     * @private
     * @returns {RegExp|Function}
     */

  }, {
    key: 'match',
    get: function get() {
      return this.props.match;
    }

    /**
     * @private
     * @returns {Number}
     */

  }, {
    key: 'index',
    get: function get() {
      return this.props.index || 2;
    }

    /**
     * @returns {function}
     */

  }, {
    key: 'template',
    get: function get() {
      return this.props.template;
    }
  }]);

  return Strategy;
}();

exports.default = Strategy;

},{"./query":15,"lodash.isfunction":6}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _editor = require('./editor');

var _editor2 = _interopRequireDefault(_editor);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var getCaretCoordinates = require('textarea-caret');

var CALLBACK_METHODS = ['onBlur', 'onKeydown', 'onKeyup'];

/**
 * Encapsulate the target textarea element.
 *
 * @extends Editor
 */

var Textarea = function (_Editor) {
  _inherits(Textarea, _Editor);

  /**
   * @param {HTMLTextAreaElement} el - Where the textcomplete works on.
   */

  function Textarea(el) {
    _classCallCheck(this, Textarea);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Textarea).call(this));

    _this.el = el;

    // Bind callback methods
    CALLBACK_METHODS.forEach(function (name) {
      _this[name] = _this[name].bind(_this);
    });

    _this.el.addEventListener('blur', _this.onBlur);
    _this.el.addEventListener('keydown', _this.onKeydown);
    _this.el.addEventListener('keyup', _this.onKeyup);
    return _this;
  }

  /**
   * @override
   * @param {SearchResult} searchResult
   */


  _createClass(Textarea, [{
    key: 'applySearchResult',
    value: function applySearchResult(searchResult) {
      var replace = searchResult.replace(this.beforeCursor, this.afterCursor);
      if (Array.isArray(replace)) {
        this.el.value = replace[0] + replace[1];
        this.el.selectionStart = this.el.selectionEnd = replace[0].length;
      }
      this.el.focus(); // Clicking a dropdown item removes focus from the element.
    }

    /**
     * @override
     * @returns {{top: number, left: number}}
     */

  }, {
    key: 'getElOffset',


    /**
     * Get the current coordinates of the `#el` relative to the document.
     *
     * @private
     * @returns {{top: number, left: number}}
     */
    value: function getElOffset() {
      var rect = this.el.getBoundingClientRect();
      var documentElement = this.el.ownerDocument.documentElement;
      return {
        top: rect.top - documentElement.clientTop,
        left: rect.left - documentElement.clientLeft
      };
    }

    /**
     * @private
     * @returns {{top: number, left: number}}
     */

  }, {
    key: 'getElScroll',
    value: function getElScroll() {
      return { top: this.el.scrollTop, left: this.el.scrollLeft };
    }

    /**
     * The input cursor's relative coordinates from the textarea's left
     * top corner.
     *
     * @private
     * @returns {{top: number, left: number}}
     */

  }, {
    key: 'getCursorPosition',
    value: function getCursorPosition() {
      // textarea-caret throws an error if `window` is undefined.
      return typeof window !== 'undefined' ? getCaretCoordinates(this.el, this.el.selectionEnd) : { top: 0, left: 0 };
    }

    /**
     * @private
     * @returns {number}
     */

  }, {
    key: 'getElLineHeight',
    value: function getElLineHeight() {
      var computed = document.defaultView.getComputedStyle(this.el);
      var lineHeight = parseInt(computed.lineHeight, 10);
      return isNaN(lineHeight) ? parseInt(computed.fontSize, 10) : lineHeight;
    }

    /**
     * @private
     * @fires Editor#blur
     * @param {FocusEvent} _e
     */

  }, {
    key: 'onBlur',
    value: function onBlur(_e) {
      this.emit('blur');
    }

    /**
     * @private
     * @fires Editor#move
     * @param {KeyboardEvent} e
     */

  }, {
    key: 'onKeydown',
    value: function onKeydown(e) {
      var code = this.getCode(e);
      if (code !== null) {
        this.emit('move', {
          code: code,
          callback: function callback() {
            e.preventDefault();
          }
        });
      }
    }

    /**
     * @private
     * @fires Editor#change
     * @param {KeyboardEvent} e
     */

  }, {
    key: 'onKeyup',
    value: function onKeyup(e) {
      if (!this.isMoveKeyEvent(e)) {
        this.emit('change', { beforeCursor: this.beforeCursor });
      }
    }

    /**
     * @private
     * @param {KeyboardEvent} e
     * @returns {boolean}
     */

  }, {
    key: 'isMoveKeyEvent',
    value: function isMoveKeyEvent(e) {
      return this.getCode(e) !== null;
    }

    /**
     * @private
     * @param {KeyboardEvent} e
     * @returns {ENTER|UP|DOWN|null}
     */

  }, {
    key: 'getCode',
    value: function getCode(e) {
      return e.keyCode === 13 ? _editor.ENTER : e.keyCode === 38 ? _editor.UP : e.keyCode === 40 ? _editor.DOWN : e.keyCode === 78 && e.ctrlKey ? _editor.DOWN : e.keyCode === 80 && e.ctrlKey ? _editor.UP : null;
    }
  }, {
    key: 'cursorOffset',
    get: function get() {
      var elOffset = this.getElOffset();
      var elScroll = this.getElScroll();
      var cursorPosition = this.getCursorPosition();
      return {
        top: elOffset.top - elScroll.top + cursorPosition.top + this.getElLineHeight(),
        left: elOffset.left - elScroll.left + cursorPosition.left
      };
    }

    /**
     * The string from head to current input cursor position.
     *
     * @private
     * @returns {string}
     */

  }, {
    key: 'beforeCursor',
    get: function get() {
      return this.el.value.substring(0, this.el.selectionEnd);
    }

    /**
     * @private
     * @returns {string}
     */

  }, {
    key: 'afterCursor',
    get: function get() {
      return this.el.value.substring(this.el.selectionEnd);
    }
  }]);

  return Textarea;
}(_editor2.default);

exports.default = Textarea;

},{"./editor":14,"textarea-caret":9}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _completer = require('./completer');

var _completer2 = _interopRequireDefault(_completer);

var _dropdown = require('./dropdown');

var _dropdown2 = _interopRequireDefault(_dropdown);

var _strategy = require('./strategy');

var _strategy2 = _interopRequireDefault(_strategy);

var _editor = require('./editor');

var _utils = require('./utils');

var _lodash = require('lodash.isfunction');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CALLBACK_METHODS = ['handleBlur', 'handleChange', 'handleHit', 'handleMove', 'handleSelect'];

/**
 * The core of textcomplete. It acts as a mediator.
 */

var Textcomplete = function () {
  /**
   * @param {Editor} editor - Where the textcomplete works on.
   * @param {object} options
   */

  function Textcomplete(editor) {
    var _this = this;

    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Textcomplete);

    this.completer = new _completer2.default();
    this.dropdown = new _dropdown2.default(options.dropdown || {});
    this.editor = editor;

    // Bind callback methods
    CALLBACK_METHODS.forEach(function (name) {
      _this[name] = _this[name].bind(_this);
    });

    this.lockableTrigger = (0, _utils.lock)(function (free, text) {
      this.free = free;
      this.completer.run(text);
    });

    this.startListening();
  }

  /**
   * @public
   * @param {Object[]} strategyPropsArray
   * @returns {this}
   * @example
   * textcomplete.register([{
   *   match: /(^|\s)(\w+)$/,
   *   search: function (term, callback) {
   *     $.ajax({ ... })
   *       .done(callback)
   *       .fail([]);
   *   },
   *   replace: function (value) {
   *     return '$1' + value + ' ';
   *   }
   * }]);
   */


  _createClass(Textcomplete, [{
    key: 'register',
    value: function register(strategyPropsArray) {
      var _this2 = this;

      strategyPropsArray.forEach(function (props) {
        _this2.completer.registerStrategy(new _strategy2.default(props));
      });
      return this;
    }

    /**
     * Start autocompleting.
     *
     * @public
     * @param {string} text - Head to input cursor.
     * @returns {this}
     * @listens Editor#change
     */

  }, {
    key: 'trigger',
    value: function trigger(text) {
      this.lockableTrigger(text);
      return this;
    }

    /**
     * Unlock trigger method.
     *
     * @private
     * @returns {this}
     */

  }, {
    key: 'unlock',
    value: function unlock() {
      // Calling free function may assign a new function to `this.free`.
      // It depends on whether extra function call was made or not.
      var free = this.free;
      this.free = null;
      if ((0, _lodash2.default)(free)) {
        free();
      }
      return this;
    }

    /**
     * @private
     * @param {SearchResult[]} searchResults
     * @listens Completer#hit
     */

  }, {
    key: 'handleHit',
    value: function handleHit(_ref) {
      var searchResults = _ref.searchResults;

      if (searchResults.length) {
        this.dropdown.render(searchResults, this.editor.cursorOffset);
      } else {
        this.dropdown.deactivate();
      }
      this.unlock();
    }

    /**
     * @private
     * @param {ENTER|UP|DOWN} code
     * @param {funcion} callback
     * @listens Editor#move
     */

  }, {
    key: 'handleMove',
    value: function handleMove(_ref2) {
      var code = _ref2.code;
      var callback = _ref2.callback;

      var method = code === _editor.ENTER ? 'selectActiveItem' : code === _editor.UP ? 'up' : code === _editor.DOWN ? 'down' : null;
      if (code !== null) {
        this.dropdown[method](callback);
      }
    }

    /**
     * @private
     * @param {string} beforeCursor
     * @listens Editor#change
     */

  }, {
    key: 'handleChange',
    value: function handleChange(_ref3) {
      var beforeCursor = _ref3.beforeCursor;

      this.trigger(beforeCursor);
    }

    /**
     * @private
     * @listens Editor#blur
     */

  }, {
    key: 'handleBlur',
    value: function handleBlur() {
      this.dropdown.deactivate();
    }

    /**
     * @private
     * @param {SearchResult} searchResult
     * @listens Dropdown#select
     */

  }, {
    key: 'handleSelect',
    value: function handleSelect(_ref4) {
      var searchResult = _ref4.searchResult;

      this.editor.applySearchResult(searchResult);
    }

    /**
     * @private
     */

  }, {
    key: 'startListening',
    value: function startListening() {
      this.editor.on('move', this.handleMove).on('change', this.handleChange).on('blur', this.handleBlur);
      this.dropdown.on('select', this.handleSelect);
      this.completer.on('hit', this.handleHit);
    }
  }]);

  return Textcomplete;
}();

exports.default = Textcomplete;

},{"./completer":10,"./dropdown":13,"./editor":14,"./strategy":17,"./utils":20,"lodash.isfunction":6}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lock = lock;
/**
 * Exclusive execution control utility.
 *
 * @param {function} func - The function to be locked. It is executed with a
 *                          function named `free` as the first argument. Once
 *                          it is called, additional execution are ignored
 *                          until the free is invoked. Then the last ignored
 *                          execution will be replayed immediately.
 * @example
 * var lockedFunc = lock(function (free) {
 *   setTimeout(function { free(); }, 1000); // It will be free in 1 sec.
 *   console.log('Hello, world');
 * });
 * lockedFunc();  // => 'Hello, world'
 * lockedFunc();  // none
 * lockedFunc();  // none
 * // 1 sec past then
 * // => 'Hello, world'
 * lockedFunc();  // => 'Hello, world'
 * lockedFunc();  // none
 * @returns {function} A wrapped function.
 */
function lock(func) {
  var locked, queuedArgsToReplay;

  return function () {
    // Convert arguments into a real array.
    var args = Array.prototype.slice.call(arguments);
    if (locked) {
      // Keep a copy of this argument list to replay later.
      // OK to overwrite a previous value because we only replay
      // the last one.
      queuedArgsToReplay = args;
      return;
    }
    locked = true;
    var self = this;
    function replayOrFree() {
      if (queuedArgsToReplay) {
        // Other request(s) arrived while we were locked.
        // Now that the lock is becoming available, replay
        // the latest such request, then call back here to
        // unlock (or replay another request that arrived
        // while this one was in flight).
        var replayArgs = queuedArgsToReplay;
        queuedArgsToReplay = undefined;
        replayArgs.unshift(replayOrFree);
        func.apply(self, replayArgs);
      } else {
        locked = false;
      }
    }
    args.unshift(replayOrFree);
    func.apply(this, args);
  };
}

},{}]},{},[11])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduaW4vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbmluL25vZGVfbW9kdWxlcy9sb2Rhc2gua2V5c2luL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ25pbi9ub2RlX21vZHVsZXMvbG9kYXNoLmtleXNpbi9ub2RlX21vZHVsZXMvbG9kYXNoLl9yb290L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ25pbi9ub2RlX21vZHVsZXMvbG9kYXNoLnJlc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzZnVuY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLnVuaXF1ZWlkL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC51bmlxdWVpZC9ub2RlX21vZHVsZXMvbG9kYXNoLnRvc3RyaW5nL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3RleHRhcmVhLWNhcmV0L2luZGV4LmpzIiwic3JjL2NvbXBsZXRlci5qcyIsInNyYy9kb2MvbWFpbi5qcyIsInNyYy9kcm9wZG93bi1pdGVtLmpzIiwic3JjL2Ryb3Bkb3duLmpzIiwic3JjL2VkaXRvci5qcyIsInNyYy9xdWVyeS5qcyIsInNyYy9zZWFyY2gtcmVzdWx0LmpzIiwic3JjL3N0cmF0ZWd5LmpzIiwic3JjL3RleHRhcmVhLmpzIiwic3JjL3RleHRjb21wbGV0ZS5qcyIsInNyYy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM3YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QVk7Ozs7QUFJViwyQkFBcUIsSUFBckIsQ0FKVTtBQUtWLGFBTFU7S0FBWjtBQU9BLGFBQVMsSUFBVCxDQVZpQjtBQVdqQixRQUFJLE9BQU8sSUFBUCxDQVhhO0FBWWpCLGFBQVMsWUFBVCxHQUF3QjtBQUN0QixVQUFJLGtCQUFKLEVBQXdCOzs7Ozs7QUFNdEIsWUFBSSxhQUFhLGtCQUFiLENBTmtCO0FBT3RCLDZCQUFxQixTQUFyQixDQVBzQjtBQVF0QixtQkFBVyxPQUFYLENBQW1CLFlBQW5CLEVBUnNCO0FBU3RCLGFBQUssS0FBTCxDQUFXLElBQVgsRUFBaUIsVUFBakIsRUFUc0I7T0FBeEIsTUFVTztBQUNMLGlCQUFTLEtBQVQsQ0FESztPQVZQO0tBREY7QUFlQSxTQUFLLE9BQUwsQ0FBYSxZQUFiLEVBM0JpQjtBQTRCakIsU0FBSyxLQUFMLENBQVcsSUFBWCxFQUFpQixJQUFqQixFQTVCaUI7R0FBWixDQUhrQjtDQUFwQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKipcbiAqIGxvZGFzaCA0LjAuMyAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIga2V5c0luID0gcmVxdWlyZSgnbG9kYXNoLmtleXNpbicpLFxuICAgIHJlc3QgPSByZXF1aXJlKCdsb2Rhc2gucmVzdCcpO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eKD86MHxbMS05XVxcZCopJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqXG4gKiBBc3NpZ25zIGB2YWx1ZWAgdG8gYGtleWAgb2YgYG9iamVjdGAgaWYgdGhlIGV4aXN0aW5nIHZhbHVlIGlzIG5vdCBlcXVpdmFsZW50XG4gKiB1c2luZyBbYFNhbWVWYWx1ZVplcm9gXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1zYW1ldmFsdWV6ZXJvKVxuICogZm9yIGVxdWFsaXR5IGNvbXBhcmlzb25zLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gbW9kaWZ5LlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBhc3NpZ24uXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBhc3NpZ24uXG4gKi9cbmZ1bmN0aW9uIGFzc2lnblZhbHVlKG9iamVjdCwga2V5LCB2YWx1ZSkge1xuICB2YXIgb2JqVmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgaWYgKCghZXEob2JqVmFsdWUsIHZhbHVlKSB8fFxuICAgICAgICAoZXEob2JqVmFsdWUsIG9iamVjdFByb3RvW2tleV0pICYmICFoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkpIHx8XG4gICAgICAodmFsdWUgPT09IHVuZGVmaW5lZCAmJiAhKGtleSBpbiBvYmplY3QpKSkge1xuICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDb3BpZXMgcHJvcGVydGllcyBvZiBgc291cmNlYCB0byBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyBmcm9tLlxuICogQHBhcmFtIHtBcnJheX0gcHJvcHMgVGhlIHByb3BlcnR5IG5hbWVzIHRvIGNvcHkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29iamVjdD17fV0gVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgdG8uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICovXG5mdW5jdGlvbiBjb3B5T2JqZWN0KHNvdXJjZSwgcHJvcHMsIG9iamVjdCkge1xuICByZXR1cm4gY29weU9iamVjdFdpdGgoc291cmNlLCBwcm9wcywgb2JqZWN0KTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGxpa2UgYGNvcHlPYmplY3RgIGV4Y2VwdCB0aGF0IGl0IGFjY2VwdHMgYSBmdW5jdGlvbiB0b1xuICogY3VzdG9taXplIGNvcGllZCB2YWx1ZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgZnJvbS5cbiAqIEBwYXJhbSB7QXJyYXl9IHByb3BzIFRoZSBwcm9wZXJ0eSBuYW1lcyB0byBjb3B5LlxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3Q9e31dIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIHRvLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2N1c3RvbWl6ZXJdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgY29waWVkIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGNvcHlPYmplY3RXaXRoKHNvdXJjZSwgcHJvcHMsIG9iamVjdCwgY3VzdG9taXplcikge1xuICBvYmplY3QgfHwgKG9iamVjdCA9IHt9KTtcblxuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG5cbiAgICB2YXIgbmV3VmFsdWUgPSBjdXN0b21pemVyXG4gICAgICA/IGN1c3RvbWl6ZXIob2JqZWN0W2tleV0sIHNvdXJjZVtrZXldLCBrZXksIG9iamVjdCwgc291cmNlKVxuICAgICAgOiBzb3VyY2Vba2V5XTtcblxuICAgIGFzc2lnblZhbHVlKG9iamVjdCwga2V5LCBuZXdWYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gbGlrZSBgXy5hc3NpZ25gLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhc3NpZ25lciBUaGUgZnVuY3Rpb24gdG8gYXNzaWduIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGFzc2lnbmVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVBc3NpZ25lcihhc3NpZ25lcikge1xuICByZXR1cm4gcmVzdChmdW5jdGlvbihvYmplY3QsIHNvdXJjZXMpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gc291cmNlcy5sZW5ndGgsXG4gICAgICAgIGN1c3RvbWl6ZXIgPSBsZW5ndGggPiAxID8gc291cmNlc1tsZW5ndGggLSAxXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgZ3VhcmQgPSBsZW5ndGggPiAyID8gc291cmNlc1syXSA6IHVuZGVmaW5lZDtcblxuICAgIGN1c3RvbWl6ZXIgPSB0eXBlb2YgY3VzdG9taXplciA9PSAnZnVuY3Rpb24nXG4gICAgICA/IChsZW5ndGgtLSwgY3VzdG9taXplcilcbiAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKGd1YXJkICYmIGlzSXRlcmF0ZWVDYWxsKHNvdXJjZXNbMF0sIHNvdXJjZXNbMV0sIGd1YXJkKSkge1xuICAgICAgY3VzdG9taXplciA9IGxlbmd0aCA8IDMgPyB1bmRlZmluZWQgOiBjdXN0b21pemVyO1xuICAgICAgbGVuZ3RoID0gMTtcbiAgICB9XG4gICAgb2JqZWN0ID0gT2JqZWN0KG9iamVjdCk7XG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciBzb3VyY2UgPSBzb3VyY2VzW2luZGV4XTtcbiAgICAgIGlmIChzb3VyY2UpIHtcbiAgICAgICAgYXNzaWduZXIob2JqZWN0LCBzb3VyY2UsIGluZGV4LCBjdXN0b21pemVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfSk7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIHZhbHVlIGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBpbmRleCBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIGluZGV4IG9yIGtleSBhcmd1bWVudC5cbiAqIEBwYXJhbSB7Kn0gb2JqZWN0IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgb2JqZWN0IGFyZ3VtZW50LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0l0ZXJhdGVlQ2FsbCh2YWx1ZSwgaW5kZXgsIG9iamVjdCkge1xuICBpZiAoIWlzT2JqZWN0KG9iamVjdCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHR5cGUgPSB0eXBlb2YgaW5kZXg7XG4gIGlmICh0eXBlID09ICdudW1iZXInXG4gICAgICA/IChpc0FycmF5TGlrZShvYmplY3QpICYmIGlzSW5kZXgoaW5kZXgsIG9iamVjdC5sZW5ndGgpKVxuICAgICAgOiAodHlwZSA9PSAnc3RyaW5nJyAmJiBpbmRleCBpbiBvYmplY3QpKSB7XG4gICAgcmV0dXJuIGVxKG9iamVjdFtpbmRleF0sIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBbYFNhbWVWYWx1ZVplcm9gXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1zYW1ldmFsdWV6ZXJvKVxuICogY29tcGFyaXNvbiBiZXR3ZWVuIHR3byB2YWx1ZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXkgYXJlIGVxdWl2YWxlbnQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb21wYXJlLlxuICogQHBhcmFtIHsqfSBvdGhlciBUaGUgb3RoZXIgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIHZhciBvYmplY3QgPSB7ICd1c2VyJzogJ2ZyZWQnIH07XG4gKiB2YXIgb3RoZXIgPSB7ICd1c2VyJzogJ2ZyZWQnIH07XG4gKlxuICogXy5lcShvYmplY3QsIG9iamVjdCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcShvYmplY3QsIG90aGVyKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcSgnYScsICdhJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcSgnYScsIE9iamVjdCgnYScpKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcShOYU4sIE5hTik7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGVxKHZhbHVlLCBvdGhlcikge1xuICByZXR1cm4gdmFsdWUgPT09IG90aGVyIHx8ICh2YWx1ZSAhPT0gdmFsdWUgJiYgb3RoZXIgIT09IG90aGVyKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLiBBIHZhbHVlIGlzIGNvbnNpZGVyZWQgYXJyYXktbGlrZSBpZiBpdCdzXG4gKiBub3QgYSBmdW5jdGlvbiBhbmQgaGFzIGEgYHZhbHVlLmxlbmd0aGAgdGhhdCdzIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIG9yXG4gKiBlcXVhbCB0byBgMGAgYW5kIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmXG4gICAgISh0eXBlb2YgdmFsdWUgPT0gJ2Z1bmN0aW9uJyAmJiBpc0Z1bmN0aW9uKHZhbHVlKSkgJiYgaXNMZW5ndGgoZ2V0TGVuZ3RoKHZhbHVlKSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycywgYW5kXG4gIC8vIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTGVuZ3RoKDMpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNMZW5ndGgoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoSW5maW5pdHkpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKCczJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmXG4gICAgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uYXNzaWduYCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIG93biBhbmRcbiAqIGluaGVyaXRlZCBzb3VyY2UgcHJvcGVydGllcy5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgbXV0YXRlcyBgb2JqZWN0YC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGFsaWFzIGV4dGVuZFxuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VzXSBUaGUgc291cmNlIG9iamVjdHMuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogZnVuY3Rpb24gQmFyKCkge1xuICogICB0aGlzLmQgPSA0O1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKiBCYXIucHJvdG90eXBlLmUgPSA1O1xuICpcbiAqIF8uYXNzaWduSW4oeyAnYSc6IDEgfSwgbmV3IEZvbywgbmV3IEJhcik7XG4gKiAvLyA9PiB7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDMsICdkJzogNCwgJ2UnOiA1IH1cbiAqL1xudmFyIGFzc2lnbkluID0gY3JlYXRlQXNzaWduZXIoZnVuY3Rpb24ob2JqZWN0LCBzb3VyY2UpIHtcbiAgY29weU9iamVjdChzb3VyY2UsIGtleXNJbihzb3VyY2UpLCBvYmplY3QpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzaWduSW47XG4iLCIvKipcbiAqIGxvZGFzaCA0LjEuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgcm9vdCA9IHJlcXVpcmUoJ2xvZGFzaC5fcm9vdCcpO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGFyZ3NUYWcgPSAnW29iamVjdCBBcmd1bWVudHNdJyxcbiAgICBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nLFxuICAgIHN0cmluZ1RhZyA9ICdbb2JqZWN0IFN0cmluZ10nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgdW5zaWduZWQgaW50ZWdlciB2YWx1ZXMuICovXG52YXIgcmVJc1VpbnQgPSAvXig/OjB8WzEtOV1cXGQqKSQvO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnRpbWVzYCB3aXRob3V0IHN1cHBvcnQgZm9yIGl0ZXJhdGVlIHNob3J0aGFuZHNcbiAqIG9yIG1heCBhcnJheSBsZW5ndGggY2hlY2tzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge251bWJlcn0gbiBUaGUgbnVtYmVyIG9mIHRpbWVzIHRvIGludm9rZSBgaXRlcmF0ZWVgLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gaXRlcmF0ZWUgVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcmVzdWx0cy5cbiAqL1xuZnVuY3Rpb24gYmFzZVRpbWVzKG4sIGl0ZXJhdGVlKSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgcmVzdWx0ID0gQXJyYXkobik7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBuKSB7XG4gICAgcmVzdWx0W2luZGV4XSA9IGl0ZXJhdGVlKGluZGV4KTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBpbmRleC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aD1NQVhfU0FGRV9JTlRFR0VSXSBUaGUgdXBwZXIgYm91bmRzIG9mIGEgdmFsaWQgaW5kZXguXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGluZGV4LCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSW5kZXgodmFsdWUsIGxlbmd0aCkge1xuICB2YWx1ZSA9ICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgcmVJc1VpbnQudGVzdCh2YWx1ZSkpID8gK3ZhbHVlIDogLTE7XG4gIGxlbmd0aCA9IGxlbmd0aCA9PSBudWxsID8gTUFYX1NBRkVfSU5URUdFUiA6IGxlbmd0aDtcbiAgcmV0dXJuIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPCBsZW5ndGg7XG59XG5cbi8qKlxuICogQ29udmVydHMgYGl0ZXJhdG9yYCB0byBhbiBhcnJheS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IGl0ZXJhdG9yIFRoZSBpdGVyYXRvciB0byBjb252ZXJ0LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBjb252ZXJ0ZWQgYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIGl0ZXJhdG9yVG9BcnJheShpdGVyYXRvcikge1xuICB2YXIgZGF0YSxcbiAgICAgIHJlc3VsdCA9IFtdO1xuXG4gIHdoaWxlICghKGRhdGEgPSBpdGVyYXRvci5uZXh0KCkpLmRvbmUpIHtcbiAgICByZXN1bHQucHVzaChkYXRhLnZhbHVlKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKiogVXNlZCB0byBjaGVjayBvYmplY3RzIGZvciBvd24gcHJvcGVydGllcy4gKi9cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IG9iamVjdFByb3RvLmhhc093blByb3BlcnR5O1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiogQnVpbHQtaW4gdmFsdWUgcmVmZXJlbmNlcy4gKi9cbnZhciBSZWZsZWN0ID0gcm9vdC5SZWZsZWN0LFxuICAgIGVudW1lcmF0ZSA9IFJlZmxlY3QgPyBSZWZsZWN0LmVudW1lcmF0ZSA6IHVuZGVmaW5lZCxcbiAgICBwcm9wZXJ0eUlzRW51bWVyYWJsZSA9IG9iamVjdFByb3RvLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmtleXNJbmAgd2hpY2ggZG9lc24ndCBza2lwIHRoZSBjb25zdHJ1Y3RvclxuICogcHJvcGVydHkgb2YgcHJvdG90eXBlcyBvciB0cmVhdCBzcGFyc2UgYXJyYXlzIGFzIGRlbnNlLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICovXG5mdW5jdGlvbiBiYXNlS2V5c0luKG9iamVjdCkge1xuICBvYmplY3QgPSBvYmplY3QgPT0gbnVsbCA/IG9iamVjdCA6IE9iamVjdChvYmplY3QpO1xuXG4gIHZhciByZXN1bHQgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gRmFsbGJhY2sgZm9yIElFIDwgOSB3aXRoIGVzNi1zaGltLlxuaWYgKGVudW1lcmF0ZSAmJiAhcHJvcGVydHlJc0VudW1lcmFibGUuY2FsbCh7ICd2YWx1ZU9mJzogMSB9LCAndmFsdWVPZicpKSB7XG4gIGJhc2VLZXlzSW4gPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gaXRlcmF0b3JUb0FycmF5KGVudW1lcmF0ZShvYmplY3QpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYSBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MilcbiAqIHRoYXQgYWZmZWN0cyBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIGluZGV4IGtleXMgZm9yIGBvYmplY3RgIHZhbHVlcyBvZiBhcnJheXMsXG4gKiBgYXJndW1lbnRzYCBvYmplY3RzLCBhbmQgc3RyaW5ncywgb3RoZXJ3aXNlIGBudWxsYCBpcyByZXR1cm5lZC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fG51bGx9IFJldHVybnMgaW5kZXgga2V5cywgZWxzZSBgbnVsbGAuXG4gKi9cbmZ1bmN0aW9uIGluZGV4S2V5cyhvYmplY3QpIHtcbiAgdmFyIGxlbmd0aCA9IG9iamVjdCA/IG9iamVjdC5sZW5ndGggOiB1bmRlZmluZWQ7XG4gIGlmIChpc0xlbmd0aChsZW5ndGgpICYmXG4gICAgICAoaXNBcnJheShvYmplY3QpIHx8IGlzU3RyaW5nKG9iamVjdCkgfHwgaXNBcmd1bWVudHMob2JqZWN0KSkpIHtcbiAgICByZXR1cm4gYmFzZVRpbWVzKGxlbmd0aCwgU3RyaW5nKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBsaWtlbHkgYSBwcm90b3R5cGUgb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcHJvdG90eXBlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzUHJvdG90eXBlKHZhbHVlKSB7XG4gIHZhciBDdG9yID0gdmFsdWUgJiYgdmFsdWUuY29uc3RydWN0b3IsXG4gICAgICBwcm90byA9ICh0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IucHJvdG90eXBlKSB8fCBvYmplY3RQcm90bztcblxuICByZXR1cm4gdmFsdWUgPT09IHByb3RvO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGxpa2VseSBhbiBgYXJndW1lbnRzYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcmd1bWVudHMoZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH0oKSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhbMSwgMiwgM10pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcbiAgLy8gU2FmYXJpIDguMSBpbmNvcnJlY3RseSBtYWtlcyBgYXJndW1lbnRzLmNhbGxlZWAgZW51bWVyYWJsZSBpbiBzdHJpY3QgbW9kZS5cbiAgcmV0dXJuIGlzQXJyYXlMaWtlT2JqZWN0KHZhbHVlKSAmJiBoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgJiZcbiAgICAoIXByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwodmFsdWUsICdjYWxsZWUnKSB8fCBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBhcmdzVGFnKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGFuIGBBcnJheWAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAdHlwZSB7RnVuY3Rpb259XG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXkoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXkoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNBcnJheSgnYWJjJyk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNBcnJheShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqL1xudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UuIEEgdmFsdWUgaXMgY29uc2lkZXJlZCBhcnJheS1saWtlIGlmIGl0J3NcbiAqIG5vdCBhIGZ1bmN0aW9uIGFuZCBoYXMgYSBgdmFsdWUubGVuZ3RoYCB0aGF0J3MgYW4gaW50ZWdlciBncmVhdGVyIHRoYW4gb3JcbiAqIGVxdWFsIHRvIGAwYCBhbmQgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUmAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFycmF5LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZSgnYWJjJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUxpa2UodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9IG51bGwgJiZcbiAgICAhKHR5cGVvZiB2YWx1ZSA9PSAnZnVuY3Rpb24nICYmIGlzRnVuY3Rpb24odmFsdWUpKSAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKTtcbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmlzQXJyYXlMaWtlYCBleGNlcHQgdGhhdCBpdCBhbHNvIGNoZWNrcyBpZiBgdmFsdWVgXG4gKiBpcyBhbiBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIGFycmF5LWxpa2Ugb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZU9iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0FycmF5TGlrZSh2YWx1ZSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycywgYW5kXG4gIC8vIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTGVuZ3RoKDMpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNMZW5ndGgoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoSW5maW5pdHkpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKCczJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmXG4gICAgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLiBBIHZhbHVlIGlzIG9iamVjdC1saWtlIGlmIGl0J3Mgbm90IGBudWxsYFxuICogYW5kIGhhcyBhIGB0eXBlb2ZgIHJlc3VsdCBvZiBcIm9iamVjdFwiLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZSh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBTdHJpbmdgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNTdHJpbmcoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNTdHJpbmcoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8XG4gICAgKCFpc0FycmF5KHZhbHVlKSAmJiBpc09iamVjdExpa2UodmFsdWUpICYmIG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpID09IHN0cmluZ1RhZyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiB0aGUgb3duIGFuZCBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogTm9uLW9iamVjdCB2YWx1ZXMgYXJlIGNvZXJjZWQgdG8gb2JqZWN0cy5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmEgPSAxO1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKlxuICogXy5rZXlzSW4obmV3IEZvbyk7XG4gKiAvLyA9PiBbJ2EnLCAnYicsICdjJ10gKGl0ZXJhdGlvbiBvcmRlciBpcyBub3QgZ3VhcmFudGVlZClcbiAqL1xuZnVuY3Rpb24ga2V5c0luKG9iamVjdCkge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGlzUHJvdG8gPSBpc1Byb3RvdHlwZShvYmplY3QpLFxuICAgICAgcHJvcHMgPSBiYXNlS2V5c0luKG9iamVjdCksXG4gICAgICBwcm9wc0xlbmd0aCA9IHByb3BzLmxlbmd0aCxcbiAgICAgIGluZGV4ZXMgPSBpbmRleEtleXMob2JqZWN0KSxcbiAgICAgIHNraXBJbmRleGVzID0gISFpbmRleGVzLFxuICAgICAgcmVzdWx0ID0gaW5kZXhlcyB8fCBbXSxcbiAgICAgIGxlbmd0aCA9IHJlc3VsdC5sZW5ndGg7XG5cbiAgd2hpbGUgKCsraW5kZXggPCBwcm9wc0xlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG4gICAgaWYgKCEoc2tpcEluZGV4ZXMgJiYgKGtleSA9PSAnbGVuZ3RoJyB8fCBpc0luZGV4KGtleSwgbGVuZ3RoKSkpICYmXG4gICAgICAgICEoa2V5ID09ICdjb25zdHJ1Y3RvcicgJiYgKGlzUHJvdG8gfHwgIWhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ga2V5c0luO1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCB0byBkZXRlcm1pbmUgaWYgdmFsdWVzIGFyZSBvZiB0aGUgbGFuZ3VhZ2UgdHlwZSBgT2JqZWN0YC4gKi9cbnZhciBvYmplY3RUeXBlcyA9IHtcbiAgJ2Z1bmN0aW9uJzogdHJ1ZSxcbiAgJ29iamVjdCc6IHRydWVcbn07XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZXhwb3J0c2AuICovXG52YXIgZnJlZUV4cG9ydHMgPSAob2JqZWN0VHlwZXNbdHlwZW9mIGV4cG9ydHNdICYmIGV4cG9ydHMgJiYgIWV4cG9ydHMubm9kZVR5cGUpXG4gID8gZXhwb3J0c1xuICA6IHVuZGVmaW5lZDtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBtb2R1bGVgLiAqL1xudmFyIGZyZWVNb2R1bGUgPSAob2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUpXG4gID8gbW9kdWxlXG4gIDogdW5kZWZpbmVkO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAgZnJvbSBOb2RlLmpzLiAqL1xudmFyIGZyZWVHbG9iYWwgPSBjaGVja0dsb2JhbChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlICYmIHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsKTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBzZWxmYC4gKi9cbnZhciBmcmVlU2VsZiA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiBzZWxmXSAmJiBzZWxmKTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGB3aW5kb3dgLiAqL1xudmFyIGZyZWVXaW5kb3cgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygd2luZG93XSAmJiB3aW5kb3cpO1xuXG4vKiogRGV0ZWN0IGB0aGlzYCBhcyB0aGUgZ2xvYmFsIG9iamVjdC4gKi9cbnZhciB0aGlzR2xvYmFsID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHRoaXNdICYmIHRoaXMpO1xuXG4vKipcbiAqIFVzZWQgYXMgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbCBvYmplY3QuXG4gKlxuICogVGhlIGB0aGlzYCB2YWx1ZSBpcyB1c2VkIGlmIGl0J3MgdGhlIGdsb2JhbCBvYmplY3QgdG8gYXZvaWQgR3JlYXNlbW9ua2V5J3NcbiAqIHJlc3RyaWN0ZWQgYHdpbmRvd2Agb2JqZWN0LCBvdGhlcndpc2UgdGhlIGB3aW5kb3dgIG9iamVjdCBpcyB1c2VkLlxuICovXG52YXIgcm9vdCA9IGZyZWVHbG9iYWwgfHxcbiAgKChmcmVlV2luZG93ICE9PSAodGhpc0dsb2JhbCAmJiB0aGlzR2xvYmFsLndpbmRvdykpICYmIGZyZWVXaW5kb3cpIHx8XG4gICAgZnJlZVNlbGYgfHwgdGhpc0dsb2JhbCB8fCBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZ2xvYmFsIG9iamVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7bnVsbHxPYmplY3R9IFJldHVybnMgYHZhbHVlYCBpZiBpdCdzIGEgZ2xvYmFsIG9iamVjdCwgZWxzZSBgbnVsbGAuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrR2xvYmFsKHZhbHVlKSB7XG4gIHJldHVybiAodmFsdWUgJiYgdmFsdWUuT2JqZWN0ID09PSBPYmplY3QpID8gdmFsdWUgOiBudWxsO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJvb3Q7XG4iLCIvKipcbiAqIGxvZGFzaCA0LjAuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHRoZSBgVHlwZUVycm9yYCBtZXNzYWdlIGZvciBcIkZ1bmN0aW9uc1wiIG1ldGhvZHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBJTkZJTklUWSA9IDEgLyAwLFxuICAgIE1BWF9JTlRFR0VSID0gMS43OTc2OTMxMzQ4NjIzMTU3ZSszMDgsXG4gICAgTkFOID0gMCAvIDA7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBtYXRjaCBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLiAqL1xudmFyIHJlVHJpbSA9IC9eXFxzK3xcXHMrJC9nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmFkIHNpZ25lZCBoZXhhZGVjaW1hbCBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNCYWRIZXggPSAvXlstK10weFswLTlhLWZdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGJpbmFyeSBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNCaW5hcnkgPSAvXjBiWzAxXSskL2k7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBvY3RhbCBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNPY3RhbCA9IC9eMG9bMC03XSskL2k7XG5cbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXG52YXIgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XG5cbi8qKlxuICogQSBmYXN0ZXIgYWx0ZXJuYXRpdmUgdG8gYEZ1bmN0aW9uI2FwcGx5YCwgdGhpcyBmdW5jdGlvbiBpbnZva2VzIGBmdW5jYFxuICogd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgYHRoaXNBcmdgIGFuZCB0aGUgYXJndW1lbnRzIG9mIGBhcmdzYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gaW52b2tlLlxuICogQHBhcmFtIHsqfSB0aGlzQXJnIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0gey4uLip9IGFyZ3MgVGhlIGFyZ3VtZW50cyB0byBpbnZva2UgYGZ1bmNgIHdpdGguXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgcmVzdWx0IG9mIGBmdW5jYC5cbiAqL1xuZnVuY3Rpb24gYXBwbHkoZnVuYywgdGhpc0FyZywgYXJncykge1xuICB2YXIgbGVuZ3RoID0gYXJncy5sZW5ndGg7XG4gIHN3aXRjaCAobGVuZ3RoKSB7XG4gICAgY2FzZSAwOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcpO1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhcmdzWzBdKTtcbiAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgY2FzZSAzOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0pO1xuICB9XG4gIHJldHVybiBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xufVxuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlTWF4ID0gTWF0aC5tYXg7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyBgZnVuY2Agd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlXG4gKiBjcmVhdGVkIGZ1bmN0aW9uIGFuZCBhcmd1bWVudHMgZnJvbSBgc3RhcnRgIGFuZCBiZXlvbmQgcHJvdmlkZWQgYXMgYW4gYXJyYXkuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIGlzIGJhc2VkIG9uIHRoZSBbcmVzdCBwYXJhbWV0ZXJdKGh0dHBzOi8vbWRuLmlvL3Jlc3RfcGFyYW1ldGVycykuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYXBwbHkgYSByZXN0IHBhcmFtZXRlciB0by5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9ZnVuYy5sZW5ndGgtMV0gVGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoZSByZXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgc2F5ID0gXy5yZXN0KGZ1bmN0aW9uKHdoYXQsIG5hbWVzKSB7XG4gKiAgIHJldHVybiB3aGF0ICsgJyAnICsgXy5pbml0aWFsKG5hbWVzKS5qb2luKCcsICcpICtcbiAqICAgICAoXy5zaXplKG5hbWVzKSA+IDEgPyAnLCAmICcgOiAnJykgKyBfLmxhc3QobmFtZXMpO1xuICogfSk7XG4gKlxuICogc2F5KCdoZWxsbycsICdmcmVkJywgJ2Jhcm5leScsICdwZWJibGVzJyk7XG4gKiAvLyA9PiAnaGVsbG8gZnJlZCwgYmFybmV5LCAmIHBlYmJsZXMnXG4gKi9cbmZ1bmN0aW9uIHJlc3QoZnVuYywgc3RhcnQpIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEZVTkNfRVJST1JfVEVYVCk7XG4gIH1cbiAgc3RhcnQgPSBuYXRpdmVNYXgoc3RhcnQgPT09IHVuZGVmaW5lZCA/IChmdW5jLmxlbmd0aCAtIDEpIDogdG9JbnRlZ2VyKHN0YXJ0KSwgMCk7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KGFyZ3MubGVuZ3RoIC0gc3RhcnQsIDApLFxuICAgICAgICBhcnJheSA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgYXJyYXlbaW5kZXhdID0gYXJnc1tzdGFydCArIGluZGV4XTtcbiAgICB9XG4gICAgc3dpdGNoIChzdGFydCkge1xuICAgICAgY2FzZSAwOiByZXR1cm4gZnVuYy5jYWxsKHRoaXMsIGFycmF5KTtcbiAgICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmdzWzBdLCBhcnJheSk7XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgYXJnc1sxXSwgYXJyYXkpO1xuICAgIH1cbiAgICB2YXIgb3RoZXJBcmdzID0gQXJyYXkoc3RhcnQgKyAxKTtcbiAgICBpbmRleCA9IC0xO1xuICAgIHdoaWxlICgrK2luZGV4IDwgc3RhcnQpIHtcbiAgICAgIG90aGVyQXJnc1tpbmRleF0gPSBhcmdzW2luZGV4XTtcbiAgICB9XG4gICAgb3RoZXJBcmdzW3N0YXJ0XSA9IGFycmF5O1xuICAgIHJldHVybiBhcHBseShmdW5jLCB0aGlzLCBvdGhlckFyZ3MpO1xuICB9O1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMsIGFuZFxuICAvLyBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGFuIGludGVnZXIuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvSW50ZWdlcmBdKGh0dHA6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2ludGVnZXIpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBpbnRlZ2VyLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvSW50ZWdlcigzKTtcbiAqIC8vID0+IDNcbiAqXG4gKiBfLnRvSW50ZWdlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDBcbiAqXG4gKiBfLnRvSW50ZWdlcihJbmZpbml0eSk7XG4gKiAvLyA9PiAxLjc5NzY5MzEzNDg2MjMxNTdlKzMwOFxuICpcbiAqIF8udG9JbnRlZ2VyKCczJyk7XG4gKiAvLyA9PiAzXG4gKi9cbmZ1bmN0aW9uIHRvSW50ZWdlcih2YWx1ZSkge1xuICBpZiAoIXZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiAwO1xuICB9XG4gIHZhbHVlID0gdG9OdW1iZXIodmFsdWUpO1xuICBpZiAodmFsdWUgPT09IElORklOSVRZIHx8IHZhbHVlID09PSAtSU5GSU5JVFkpIHtcbiAgICB2YXIgc2lnbiA9ICh2YWx1ZSA8IDAgPyAtMSA6IDEpO1xuICAgIHJldHVybiBzaWduICogTUFYX0lOVEVHRVI7XG4gIH1cbiAgdmFyIHJlbWFpbmRlciA9IHZhbHVlICUgMTtcbiAgcmV0dXJuIHZhbHVlID09PSB2YWx1ZSA/IChyZW1haW5kZXIgPyB2YWx1ZSAtIHJlbWFpbmRlciA6IHZhbHVlKSA6IDA7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIG51bWJlci5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udG9OdW1iZXIoMyk7XG4gKiAvLyA9PiAzXG4gKlxuICogXy50b051bWJlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDVlLTMyNFxuICpcbiAqIF8udG9OdW1iZXIoSW5maW5pdHkpO1xuICogLy8gPT4gSW5maW5pdHlcbiAqXG4gKiBfLnRvTnVtYmVyKCczJyk7XG4gKiAvLyA9PiAzXG4gKi9cbmZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlKSB7XG4gIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICB2YXIgb3RoZXIgPSBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpID8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgdmFsdWUgPSBpc09iamVjdChvdGhlcikgPyAob3RoZXIgKyAnJykgOiBvdGhlcjtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlICE9ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiArdmFsdWU7XG4gIH1cbiAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKHJlVHJpbSwgJycpO1xuICB2YXIgaXNCaW5hcnkgPSByZUlzQmluYXJ5LnRlc3QodmFsdWUpO1xuICByZXR1cm4gKGlzQmluYXJ5IHx8IHJlSXNPY3RhbC50ZXN0KHZhbHVlKSlcbiAgICA/IGZyZWVQYXJzZUludCh2YWx1ZS5zbGljZSgyKSwgaXNCaW5hcnkgPyAyIDogOClcbiAgICA6IChyZUlzQmFkSGV4LnRlc3QodmFsdWUpID8gTkFOIDogK3ZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZXN0O1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjggKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgZ2VuVGFnID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gU2FmYXJpIDggd2hpY2ggcmV0dXJucyAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLCBhbmRcbiAgLy8gUGhhbnRvbUpTIDEuOSB3aGljaCByZXR1cm5zICdmdW5jdGlvbicgZm9yIGBOb2RlTGlzdGAgaW5zdGFuY2VzLlxuICB2YXIgdGFnID0gaXNPYmplY3QodmFsdWUpID8gb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgcmV0dXJuIHRhZyA9PSBmdW5jVGFnIHx8IHRhZyA9PSBnZW5UYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvbjtcbiIsIi8qKlxuICogbG9kYXNoIDQuMC4wIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciB0b1N0cmluZyA9IHJlcXVpcmUoJ2xvZGFzaC50b3N0cmluZycpO1xuXG4vKiogVXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgSURzLiAqL1xudmFyIGlkQ291bnRlciA9IDA7XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgdW5pcXVlIElELiBJZiBgcHJlZml4YCBpcyBnaXZlbiB0aGUgSUQgaXMgYXBwZW5kZWQgdG8gaXQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBVdGlsXG4gKiBAcGFyYW0ge3N0cmluZ30gW3ByZWZpeF0gVGhlIHZhbHVlIHRvIHByZWZpeCB0aGUgSUQgd2l0aC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHVuaXF1ZSBJRC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy51bmlxdWVJZCgnY29udGFjdF8nKTtcbiAqIC8vID0+ICdjb250YWN0XzEwNCdcbiAqXG4gKiBfLnVuaXF1ZUlkKCk7XG4gKiAvLyA9PiAnMTA1J1xuICovXG5mdW5jdGlvbiB1bmlxdWVJZChwcmVmaXgpIHtcbiAgdmFyIGlkID0gKytpZENvdW50ZXI7XG4gIHJldHVybiB0b1N0cmluZyhwcmVmaXgpICsgaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdW5pcXVlSWQ7XG4iLCIvKipcbiAqIGxvZGFzaCA0LjEuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIElORklOSVRZID0gMSAvIDA7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBzeW1ib2xUYWcgPSAnW29iamVjdCBTeW1ib2xdJztcblxuLyoqIFVzZWQgdG8gZGV0ZXJtaW5lIGlmIHZhbHVlcyBhcmUgb2YgdGhlIGxhbmd1YWdlIHR5cGUgYE9iamVjdGAuICovXG52YXIgb2JqZWN0VHlwZXMgPSB7XG4gICdmdW5jdGlvbic6IHRydWUsXG4gICdvYmplY3QnOiB0cnVlXG59O1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxuICA/IGV4cG9ydHNcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxuICA/IG1vZHVsZVxuICA6IHVuZGVmaW5lZDtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcblxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcblxuLyoqXG4gKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXG4gKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cbiAqL1xudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XG4gICgoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxuICAgIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGdsb2JhbCBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge251bGx8T2JqZWN0fSBSZXR1cm5zIGB2YWx1ZWAgaWYgaXQncyBhIGdsb2JhbCBvYmplY3QsIGVsc2UgYG51bGxgLlxuICovXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgU3ltYm9sID0gcm9vdC5TeW1ib2w7XG5cbi8qKiBVc2VkIHRvIGNvbnZlcnQgc3ltYm9scyB0byBwcmltaXRpdmVzIGFuZCBzdHJpbmdzLiAqL1xudmFyIHN5bWJvbFByb3RvID0gU3ltYm9sID8gU3ltYm9sLnByb3RvdHlwZSA6IHVuZGVmaW5lZCxcbiAgICBzeW1ib2xUb1N0cmluZyA9IFN5bWJvbCA/IHN5bWJvbFByb3RvLnRvU3RyaW5nIDogdW5kZWZpbmVkO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLiBBIHZhbHVlIGlzIG9iamVjdC1saWtlIGlmIGl0J3Mgbm90IGBudWxsYFxuICogYW5kIGhhcyBhIGB0eXBlb2ZgIHJlc3VsdCBvZiBcIm9iamVjdFwiLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZSh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBTeW1ib2xgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNTeW1ib2woU3ltYm9sLml0ZXJhdG9yKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzU3ltYm9sKCdhYmMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3ltYm9sKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ3N5bWJvbCcgfHxcbiAgICAoaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBzeW1ib2xUYWcpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYSBzdHJpbmcgaWYgaXQncyBub3Qgb25lLiBBbiBlbXB0eSBzdHJpbmcgaXMgcmV0dXJuZWRcbiAqIGZvciBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIHZhbHVlcy4gVGhlIHNpZ24gb2YgYC0wYCBpcyBwcmVzZXJ2ZWQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBwcm9jZXNzLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgc3RyaW5nLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvU3RyaW5nKG51bGwpO1xuICogLy8gPT4gJydcbiAqXG4gKiBfLnRvU3RyaW5nKC0wKTtcbiAqIC8vID0+ICctMCdcbiAqXG4gKiBfLnRvU3RyaW5nKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiAnMSwyLDMnXG4gKi9cbmZ1bmN0aW9uIHRvU3RyaW5nKHZhbHVlKSB7XG4gIC8vIEV4aXQgZWFybHkgZm9yIHN0cmluZ3MgdG8gYXZvaWQgYSBwZXJmb3JtYW5jZSBoaXQgaW4gc29tZSBlbnZpcm9ubWVudHMuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgaWYgKGlzU3ltYm9sKHZhbHVlKSkge1xuICAgIHJldHVybiBTeW1ib2wgPyBzeW1ib2xUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICB9XG4gIHZhciByZXN1bHQgPSAodmFsdWUgKyAnJyk7XG4gIHJldHVybiAocmVzdWx0ID09ICcwJyAmJiAoMSAvIHZhbHVlKSA9PSAtSU5GSU5JVFkpID8gJy0wJyA6IHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0b1N0cmluZztcbiIsIi8qIGpzaGludCBicm93c2VyOiB0cnVlICovXG5cbihmdW5jdGlvbiAoKSB7XG5cbi8vIFRoZSBwcm9wZXJ0aWVzIHRoYXQgd2UgY29weSBpbnRvIGEgbWlycm9yZWQgZGl2LlxuLy8gTm90ZSB0aGF0IHNvbWUgYnJvd3NlcnMsIHN1Y2ggYXMgRmlyZWZveCxcbi8vIGRvIG5vdCBjb25jYXRlbmF0ZSBwcm9wZXJ0aWVzLCBpLmUuIHBhZGRpbmctdG9wLCBib3R0b20gZXRjLiAtPiBwYWRkaW5nLFxuLy8gc28gd2UgaGF2ZSB0byBkbyBldmVyeSBzaW5nbGUgcHJvcGVydHkgc3BlY2lmaWNhbGx5LlxudmFyIHByb3BlcnRpZXMgPSBbXG4gICdkaXJlY3Rpb24nLCAgLy8gUlRMIHN1cHBvcnRcbiAgJ2JveFNpemluZycsXG4gICd3aWR0aCcsICAvLyBvbiBDaHJvbWUgYW5kIElFLCBleGNsdWRlIHRoZSBzY3JvbGxiYXIsIHNvIHRoZSBtaXJyb3IgZGl2IHdyYXBzIGV4YWN0bHkgYXMgdGhlIHRleHRhcmVhIGRvZXNcbiAgJ2hlaWdodCcsXG4gICdvdmVyZmxvd1gnLFxuICAnb3ZlcmZsb3dZJywgIC8vIGNvcHkgdGhlIHNjcm9sbGJhciBmb3IgSUVcblxuICAnYm9yZGVyVG9wV2lkdGgnLFxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXG4gICdib3JkZXJCb3R0b21XaWR0aCcsXG4gICdib3JkZXJMZWZ0V2lkdGgnLFxuICAnYm9yZGVyU3R5bGUnLFxuXG4gICdwYWRkaW5nVG9wJyxcbiAgJ3BhZGRpbmdSaWdodCcsXG4gICdwYWRkaW5nQm90dG9tJyxcbiAgJ3BhZGRpbmdMZWZ0JyxcblxuICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9DU1MvZm9udFxuICAnZm9udFN0eWxlJyxcbiAgJ2ZvbnRWYXJpYW50JyxcbiAgJ2ZvbnRXZWlnaHQnLFxuICAnZm9udFN0cmV0Y2gnLFxuICAnZm9udFNpemUnLFxuICAnZm9udFNpemVBZGp1c3QnLFxuICAnbGluZUhlaWdodCcsXG4gICdmb250RmFtaWx5JyxcblxuICAndGV4dEFsaWduJyxcbiAgJ3RleHRUcmFuc2Zvcm0nLFxuICAndGV4dEluZGVudCcsXG4gICd0ZXh0RGVjb3JhdGlvbicsICAvLyBtaWdodCBub3QgbWFrZSBhIGRpZmZlcmVuY2UsIGJ1dCBiZXR0ZXIgYmUgc2FmZVxuXG4gICdsZXR0ZXJTcGFjaW5nJyxcbiAgJ3dvcmRTcGFjaW5nJyxcblxuICAndGFiU2l6ZScsXG4gICdNb3pUYWJTaXplJ1xuXG5dO1xuXG52YXIgaXNCcm93c2VyID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKTtcbnZhciBpc0ZpcmVmb3ggPSAoaXNCcm93c2VyICYmIHdpbmRvdy5tb3pJbm5lclNjcmVlblggIT0gbnVsbCk7XG5cbmZ1bmN0aW9uIGdldENhcmV0Q29vcmRpbmF0ZXMoZWxlbWVudCwgcG9zaXRpb24sIG9wdGlvbnMpIHtcbiAgaWYoIWlzQnJvd3Nlcikge1xuICAgIHRocm93IG5ldyBFcnJvcigndGV4dGFyZWEtY2FyZXQtcG9zaXRpb24jZ2V0Q2FyZXRDb29yZGluYXRlcyBzaG91bGQgb25seSBiZSBjYWxsZWQgaW4gYSBicm93c2VyJyk7XG4gIH1cblxuICB2YXIgZGVidWcgPSBvcHRpb25zICYmIG9wdGlvbnMuZGVidWcgfHwgZmFsc2U7XG4gIGlmIChkZWJ1Zykge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNpbnB1dC10ZXh0YXJlYS1jYXJldC1wb3NpdGlvbi1taXJyb3ItZGl2Jyk7XG4gICAgaWYgKCBlbCApIHsgZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbCk7IH1cbiAgfVxuXG4gIC8vIG1pcnJvcmVkIGRpdlxuICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGRpdi5pZCA9ICdpbnB1dC10ZXh0YXJlYS1jYXJldC1wb3NpdGlvbi1taXJyb3ItZGl2JztcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaXYpO1xuXG4gIHZhciBzdHlsZSA9IGRpdi5zdHlsZTtcbiAgdmFyIGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGU/IGdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkgOiBlbGVtZW50LmN1cnJlbnRTdHlsZTsgIC8vIGN1cnJlbnRTdHlsZSBmb3IgSUUgPCA5XG5cbiAgLy8gZGVmYXVsdCB0ZXh0YXJlYSBzdHlsZXNcbiAgc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUtd3JhcCc7XG4gIGlmIChlbGVtZW50Lm5vZGVOYW1lICE9PSAnSU5QVVQnKVxuICAgIHN0eWxlLndvcmRXcmFwID0gJ2JyZWFrLXdvcmQnOyAgLy8gb25seSBmb3IgdGV4dGFyZWEtc1xuXG4gIC8vIHBvc2l0aW9uIG9mZi1zY3JlZW5cbiAgc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnOyAgLy8gcmVxdWlyZWQgdG8gcmV0dXJuIGNvb3JkaW5hdGVzIHByb3Blcmx5XG4gIGlmICghZGVidWcpXG4gICAgc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nOyAgLy8gbm90ICdkaXNwbGF5OiBub25lJyBiZWNhdXNlIHdlIHdhbnQgcmVuZGVyaW5nXG5cbiAgLy8gdHJhbnNmZXIgdGhlIGVsZW1lbnQncyBwcm9wZXJ0aWVzIHRvIHRoZSBkaXZcbiAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uIChwcm9wKSB7XG4gICAgc3R5bGVbcHJvcF0gPSBjb21wdXRlZFtwcm9wXTtcbiAgfSk7XG5cbiAgaWYgKGlzRmlyZWZveCkge1xuICAgIC8vIEZpcmVmb3ggbGllcyBhYm91dCB0aGUgb3ZlcmZsb3cgcHJvcGVydHkgZm9yIHRleHRhcmVhczogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9OTg0Mjc1XG4gICAgaWYgKGVsZW1lbnQuc2Nyb2xsSGVpZ2h0ID4gcGFyc2VJbnQoY29tcHV0ZWQuaGVpZ2h0KSlcbiAgICAgIHN0eWxlLm92ZXJmbG93WSA9ICdzY3JvbGwnO1xuICB9IGVsc2Uge1xuICAgIHN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7ICAvLyBmb3IgQ2hyb21lIHRvIG5vdCByZW5kZXIgYSBzY3JvbGxiYXI7IElFIGtlZXBzIG92ZXJmbG93WSA9ICdzY3JvbGwnXG4gIH1cblxuICBkaXYudGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZygwLCBwb3NpdGlvbik7XG4gIC8vIHRoZSBzZWNvbmQgc3BlY2lhbCBoYW5kbGluZyBmb3IgaW5wdXQgdHlwZT1cInRleHRcIiB2cyB0ZXh0YXJlYTogc3BhY2VzIG5lZWQgdG8gYmUgcmVwbGFjZWQgd2l0aCBub24tYnJlYWtpbmcgc3BhY2VzIC0gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTM0MDIwMzUvMTI2OTAzN1xuICBpZiAoZWxlbWVudC5ub2RlTmFtZSA9PT0gJ0lOUFVUJylcbiAgICBkaXYudGV4dENvbnRlbnQgPSBkaXYudGV4dENvbnRlbnQucmVwbGFjZSgvXFxzL2csICdcXHUwMGEwJyk7XG5cbiAgdmFyIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIC8vIFdyYXBwaW5nIG11c3QgYmUgcmVwbGljYXRlZCAqZXhhY3RseSosIGluY2x1ZGluZyB3aGVuIGEgbG9uZyB3b3JkIGdldHNcbiAgLy8gb250byB0aGUgbmV4dCBsaW5lLCB3aXRoIHdoaXRlc3BhY2UgYXQgdGhlIGVuZCBvZiB0aGUgbGluZSBiZWZvcmUgKCM3KS5cbiAgLy8gVGhlICAqb25seSogcmVsaWFibGUgd2F5IHRvIGRvIHRoYXQgaXMgdG8gY29weSB0aGUgKmVudGlyZSogcmVzdCBvZiB0aGVcbiAgLy8gdGV4dGFyZWEncyBjb250ZW50IGludG8gdGhlIDxzcGFuPiBjcmVhdGVkIGF0IHRoZSBjYXJldCBwb3NpdGlvbi5cbiAgLy8gZm9yIGlucHV0cywganVzdCAnLicgd291bGQgYmUgZW5vdWdoLCBidXQgd2h5IGJvdGhlcj9cbiAgc3Bhbi50ZXh0Q29udGVudCA9IGVsZW1lbnQudmFsdWUuc3Vic3RyaW5nKHBvc2l0aW9uKSB8fCAnLic7ICAvLyB8fCBiZWNhdXNlIGEgY29tcGxldGVseSBlbXB0eSBmYXV4IHNwYW4gZG9lc24ndCByZW5kZXIgYXQgYWxsXG4gIGRpdi5hcHBlbmRDaGlsZChzcGFuKTtcblxuICB2YXIgY29vcmRpbmF0ZXMgPSB7XG4gICAgdG9wOiBzcGFuLm9mZnNldFRvcCArIHBhcnNlSW50KGNvbXB1dGVkWydib3JkZXJUb3BXaWR0aCddKSxcbiAgICBsZWZ0OiBzcGFuLm9mZnNldExlZnQgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyTGVmdFdpZHRoJ10pXG4gIH07XG5cbiAgaWYgKGRlYnVnKSB7XG4gICAgc3Bhbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnI2FhYSc7XG4gIH0gZWxzZSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaXYpO1xuICB9XG5cbiAgcmV0dXJuIGNvb3JkaW5hdGVzO1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBnZXRDYXJldENvb3JkaW5hdGVzO1xufSBlbHNlIGlmKGlzQnJvd3Nlcil7XG4gIHdpbmRvdy5nZXRDYXJldENvb3JkaW5hdGVzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcbn1cblxufSgpKTtcbiIsImltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdldmVudHMnO1xuXG5jb25zdCBDQUxMQkFDS19NRVRIT0RTID0gWydoYW5kbGVRdWVyeVJlc3VsdCddO1xuXG4vKipcbiAqIEBleHRlbmRzIEV2ZW50RW1pdHRlclxuICovXG5jbGFzcyBDb21wbGV0ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyYXRlZ2llcyA9IFtdO1xuXG4gICAgLy8gQmluZCBjYWxsYmFjayBtZXRob2RzXG4gICAgQ0FMTEJBQ0tfTUVUSE9EUy5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgdGhpc1tuYW1lXSA9IHRoaXNbbmFtZV0uYmluZCh0aGlzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHN0cmF0ZWd5IHRvIHRoZSBjb21wbGV0ZXIuXG4gICAqXG4gICAqIEBwdWJsaWNcbiAgICogQHBhcmFtIHtTdHJhdGVneX0gc3RyYXRlZ3lcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICByZWdpc3RlclN0cmF0ZWd5KHN0cmF0ZWd5KSB7XG4gICAgdGhpcy5zdHJhdGVnaWVzLnB1c2goc3RyYXRlZ3kpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwdWJsaWNcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBIZWFkIHRvIGlucHV0IGN1cnNvci5cbiAgICogQGZpcmVzIENvbXBsZXRlciNoaXRcbiAgICovXG4gIHJ1bih0ZXh0KSB7XG4gICAgdmFyIHF1ZXJ5ID0gdGhpcy5leHRyYWN0UXVlcnkodGV4dCk7XG4gICAgaWYgKHF1ZXJ5KSB7XG4gICAgICBxdWVyeS5leGVjdXRlKHRoaXMuaGFuZGxlUXVlcnlSZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmhhbmRsZVF1ZXJ5UmVzdWx0KFtdKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRmluZCBhIHF1ZXJ5LCB3aGljaCBtYXRjaGVzIHRvIHRoZSBnaXZlbiB0ZXh0LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIEhlYWQgdG8gaW5wdXQgY3Vyc29yLlxuICAgKiBAcmV0dXJucyB7P1F1ZXJ5fVxuICAgKi9cbiAgZXh0cmFjdFF1ZXJ5KHRleHQpIHtcbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5zdHJhdGVnaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZXQgcXVlcnkgPSB0aGlzLnN0cmF0ZWdpZXNbaV0uYnVpbGRRdWVyeSh0ZXh0KTtcbiAgICAgIGlmIChxdWVyeSkgeyByZXR1cm4gcXVlcnk7IH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2tlZCBieSBRdWVyeSNleGVjdXRlLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdFtdfSBzZWFyY2hSZXN1bHRzXG4gICAqL1xuICBoYW5kbGVRdWVyeVJlc3VsdChzZWFyY2hSZXN1bHRzKSB7XG4gICAgLyoqXG4gICAgICogQGV2ZW50IENvbXBsZXRlciNoaXRcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wIHtTZWFyY2hSZXN1bHRbXX0gc2VhcmNoUmVzdWx0c1xuICAgICAqL1xuICAgIHRoaXMuZW1pdCgnaGl0JywgeyBzZWFyY2hSZXN1bHRzIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbXBsZXRlcjtcbiIsImltcG9ydCBUZXh0Y29tcGxldGUgZnJvbSAnLi4vdGV4dGNvbXBsZXRlJztcblxuaW1wb3J0IFRleHRhcmVhIGZyb20gJy4uL3RleHRhcmVhJztcblxudmFyIHRleHRhcmVhID0gbmV3IFRleHRhcmVhKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0ZXh0YXJlYTEnKSk7XG52YXIgdGV4dGNvbXBsZXRlID0gbmV3IFRleHRjb21wbGV0ZSh0ZXh0YXJlYSk7XG50ZXh0Y29tcGxldGUucmVnaXN0ZXIoW1xuICB7XG4gICAgbWF0Y2g6IC8oXnxcXHMpKFxcdyspJC8sXG4gICAgc2VhcmNoOiBmdW5jdGlvbiAodGVybSwgY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKFt0ZXJtLnRvVXBwZXJDYXNlKCksIHRlcm0udG9Mb3dlckNhc2UoKV0pO1xuICAgIH0sXG4gICAgcmVwbGFjZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICByZXR1cm4gYCQxJHt2YWx1ZX0gYDtcbiAgICB9XG4gIH1cbl0pO1xuIiwiaW1wb3J0IHVuaXF1ZUlkIGZyb20gJ2xvZGFzaC51bmlxdWVpZCc7XG5cbmNvbnN0IElOQUNUSVZFX0NMQVNTX05BTUUgPSAndGV4dGNvbXBsZXRlLWl0ZW0nO1xuY29uc3QgQUNUSVZFX0NMQVNTX05BTUUgPSBgJHtJTkFDVElWRV9DTEFTU19OQU1FfSBhY3RpdmVgO1xuY29uc3QgQ0FMTEJBQ0tfTUVUSE9EUyA9IFsnb25DbGljayddO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIGFuIGl0ZW0gb2YgZHJvcGRvd24uXG4gKi9cbmNsYXNzIERyb3Bkb3duSXRlbSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdH0gc2VhcmNoUmVzdWx0XG4gICAqL1xuICBjb25zdHJ1Y3RvcihzZWFyY2hSZXN1bHQpIHtcbiAgICB0aGlzLnNlYXJjaFJlc3VsdCA9IHNlYXJjaFJlc3VsdDtcbiAgICB0aGlzLmlkID0gdW5pcXVlSWQoJ2Ryb3Bkb3duLWl0ZW0tJyk7XG4gICAgdGhpcy5hY3RpdmUgPSBmYWxzZTtcblxuICAgIENBTExCQUNLX01FVEhPRFMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdLmJpbmQodGhpcyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7SFRNTExJRWxlbWVudH1cbiAgICovXG4gIGdldCBlbCgpIHtcbiAgICBpZiAoIXRoaXMuX2VsKSB7XG4gICAgICBsZXQgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICAgICAgbGkuaWQgPSB0aGlzLmlkO1xuICAgICAgbGkuY2xhc3NOYW1lID0gdGhpcy5hY3RpdmUgPyBBQ1RJVkVfQ0xBU1NfTkFNRSA6IElOQUNUSVZFX0NMQVNTX05BTUU7XG4gICAgICBsZXQgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgIGEuaW5uZXJIVE1MID0gdGhpcy5zZWFyY2hSZXN1bHQucmVuZGVyKCk7XG4gICAgICBsaS5hcHBlbmRDaGlsZChhKTtcbiAgICAgIHRoaXMuX2VsID0gbGk7XG4gICAgICBsaS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm9uQ2xpY2spO1xuICAgICAgbGkuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMub25DbGljayk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9lbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBUcnkgdG8gZnJlZSByZXNvdXJjZXMgYW5kIHBlcmZvcm0gb3RoZXIgY2xlYW51cCBvcGVyYXRpb25zLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqL1xuICBmaW5hbGl6ZSgpIHtcbiAgICB0aGlzLl9lbC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm9uQ2xpY2ssIGZhbHNlKTtcbiAgICB0aGlzLl9lbC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5vbkNsaWNrLCBmYWxzZSk7XG4gICAgLy8gVGhpcyBlbGVtZW50IGhhcyBhbHJlYWR5IGJlZW4gcmVtb3ZlZCBieSBgRHJvcGRvd24jY2xlYXJgLlxuICAgIHRoaXMuX2VsID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFja2VkIHdoZW4gaXQgaXMgYXBwZW5kZWQgdG8gYSBkcm9wZG93bi5cbiAgICpcbiAgICogQHB1YmxpY1xuICAgKiBAcGFyYW0ge0Ryb3Bkb3dufSBkcm9wZG93blxuICAgKiBAc2VlIERyb3Bkb3duI2FwcGVuZFxuICAgKi9cbiAgYXBwZW5kZWQoZHJvcGRvd24pIHtcbiAgICB0aGlzLmRyb3Bkb3duID0gZHJvcGRvd247XG4gICAgdGhpcy5zaWJsaW5ncyA9IGRyb3Bkb3duLml0ZW1zO1xuICAgIHRoaXMuaW5kZXggPSB0aGlzLnNpYmxpbmdzLmxlbmd0aCAtIDE7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IDApIHtcbiAgICAgIHRoaXMuYWN0aXZhdGUoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIGFjdGl2YXRlKCkge1xuICAgIGlmICghdGhpcy5hY3RpdmUpIHtcbiAgICAgIHRoaXMuYWN0aXZlID0gdHJ1ZTtcbiAgICAgIHRoaXMuZWwuY2xhc3NOYW1lID0gQUNUSVZFX0NMQVNTX05BTUU7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwdWJsaWNcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBkZWFjdGl2YXRlKCkge1xuICAgIGlmICh0aGlzLmFjdGl2ZSkge1xuICAgICAgdGhpcy5hY3RpdmUgPSBmYWxzZTtcbiAgICAgIHRoaXMuZWwuY2xhc3NOYW1lID0gSU5BQ1RJVkVfQ0xBU1NfTkFNRTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBuZXh0IHNpYmxpbmcuXG4gICAqXG4gICAqIEBwdWJsaWNcbiAgICogQHJldHVybnMge0Ryb3Bkb3duSXRlbX1cbiAgICovXG4gIGdldCBuZXh0KCkge1xuICAgIHZhciBuZXh0SW5kZXggPSAodGhpcy5pbmRleCA9PT0gdGhpcy5zaWJsaW5ncy5sZW5ndGggLSAxID8gMCA6IHRoaXMuaW5kZXggKyAxKTtcbiAgICByZXR1cm4gdGhpcy5zaWJsaW5nc1tuZXh0SW5kZXhdO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgcHJldmlvdXMgc2libGluZy5cbiAgICpcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7RHJvcGRvd25JdGVtfVxuICAgKi9cbiAgZ2V0IHByZXYoKSB7XG4gICAgdmFyIHByZXZJbmRleCA9ICh0aGlzLmluZGV4ID09PSAwID8gdGhpcy5zaWJsaW5ncy5sZW5ndGggOiB0aGlzLmluZGV4KSAtIDE7XG4gICAgcmV0dXJuIHRoaXMuc2libGluZ3NbcHJldkluZGV4XTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGVcbiAgICovXG4gIG9uQ2xpY2soZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTsgLy8gUHJldmVudCBibHVyIGV2ZW50XG4gICAgdGhpcy5kcm9wZG93bi5zZWxlY3QodGhpcyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRHJvcGRvd25JdGVtO1xuIiwiaW1wb3J0IERyb3Bkb3duSXRlbSBmcm9tICcuL2Ryb3Bkb3duLWl0ZW0nO1xuaW1wb3J0IGV4dGVuZCBmcm9tICdsb2Rhc2guYXNzaWduaW4nO1xuaW1wb3J0IHVuaXF1ZUlkIGZyb20gJ2xvZGFzaC51bmlxdWVpZCc7XG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuLyoqXG4gKiBFbmNhcHN1bGF0ZSBhIGRyb3Bkb3duIHZpZXcuXG4gKlxuICogQHByb3Age2Jvb2xlYW59IHNob3duIC0gV2hldGhlciB0aGUgI2VsIGlzIHNob3duIG9yIG5vdC5cbiAqIEBwcm9wIHtEcm9wZG93bkl0ZW1bXX0gaXRlbXMgLSBUaGUgYXJyYXkgb2YgcmVuZGVyZWQgZHJvcGRvd24gaXRlbXMuXG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqL1xuY2xhc3MgRHJvcGRvd24gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAvKipcbiAgICogQHJldHVybnMge0hUTUxVTGlzdEVsZW1lbnR9XG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRWxlbWVudCgpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd1bCcpO1xuICAgIGVsLmNsYXNzTmFtZSA9ICdkcm9wZG93bi1tZW51IHRleHRjb21wbGV0ZS1kcm9wZG93bic7XG4gICAgZWwuaWQgPSB1bmlxdWVJZCgndGV4dGNvbXBsZXRlLWRyb3Bkb3duLScpO1xuICAgIGV4dGVuZChlbC5zdHlsZSwge1xuICAgICAgZGlzcGxheTogJ25vbmUnLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgekluZGV4OiAxMDAwMCxcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsKTtcbiAgICByZXR1cm4gZWw7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHs/c3RyaW5nfSBjbGFzc05hbWUgLSBUaGUgY2xhc3MgYXR0cmlidXRlIG9mIHRoZSBlbC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHtjbGFzc05hbWV9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnNob3duID0gZmFsc2U7XG4gICAgdGhpcy5pdGVtcyA9IFtdO1xuICAgIGlmIChjbGFzc05hbWUpIHtcbiAgICAgIHRoaXMuZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7SFRNTFVMaXN0RWxlbWVudH1cbiAgICovXG4gIGdldCBlbCgpIHtcbiAgICB0aGlzLl9lbCB8fCAodGhpcy5fZWwgPSBEcm9wZG93bi5jcmVhdGVFbGVtZW50KCkpO1xuICAgIHJldHVybiB0aGlzLl9lbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgZ2V0IGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogUmVuZGVyIHRoZSBnaXZlbiBkYXRhIGFzIGRyb3Bkb3duIGl0ZW1zLlxuICAgKlxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdFtdfSBzZWFyY2hSZXN1bHRzXG4gICAqIEBwYXJhbSB7e3RvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXJ9fSBjdXJzb3JPZmZzZXRcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICByZW5kZXIoc2VhcmNoUmVzdWx0cywgY3Vyc29yT2Zmc2V0KSB7XG4gICAgdGhpcy5jbGVhcigpLmFwcGVuZChzZWFyY2hSZXN1bHRzLm1hcCgoc2VhcmNoUmVzdWx0KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IERyb3Bkb3duSXRlbShzZWFyY2hSZXN1bHQpO1xuICAgIH0pKTtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5sZW5ndGggPiAwID8gdGhpcy5zZXRPZmZzZXQoY3Vyc29yT2Zmc2V0KS5zaG93KCkgOiB0aGlzLmhpZGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBIaWRlIHRoZSBkcm9wZG93biB0aGVuIHN3ZWVwIG91dCBpdGVtcy5cbiAgICpcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBkZWFjdGl2YXRlKCkge1xuICAgIHJldHVybiB0aGlzLmhpZGUoKS5jbGVhcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7RHJvcGRvd25JdGVtfSBkcm9wZG93bkl0ZW1cbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqIEBmaXJlcyBEcm9wZG93biNzZWxlY3RcbiAgICovXG4gIHNlbGVjdChkcm9wZG93bkl0ZW0pIHtcbiAgICAvKipcbiAgICAgICogQGV2ZW50IERyb3Bkb3duI3NlbGVjdFxuICAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAgKiBAcHJvcCB7U2VhcmNoUmVzdWx0fSBzZWFyY2hSZXN1bHRcbiAgICAgICovXG4gICAgdGhpcy5lbWl0KCdzZWxlY3QnLCB7IHNlYXJjaFJlc3VsdDogZHJvcGRvd25JdGVtLnNlYXJjaFJlc3VsdCB9KTtcbiAgICByZXR1cm4gdGhpcy5kZWFjdGl2YXRlKCk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqIEBmaXJlcyBEcm9wZG93biNzZWxlY3RcbiAgICovXG4gIHNlbGVjdEFjdGl2ZUl0ZW0oY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5zaG93bikge1xuICAgICAgdmFyIGFjdGl2ZUl0ZW0gPSB0aGlzLmdldEFjdGl2ZUl0ZW0oKTtcbiAgICAgIGlmIChhY3RpdmVJdGVtKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0KGFjdGl2ZUl0ZW0pO1xuICAgICAgICBjYWxsYmFjayhhY3RpdmVJdGVtKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICB1cChjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLm1vdmVBY3RpdmVJdGVtKCdwcmV2JywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgZG93bihjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLm1vdmVBY3RpdmVJdGVtKCduZXh0JywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBpdGVtcyB0byBkcm9wZG93bi5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtEcm9wZG93bkl0ZW1bXX0gaXRlbXNcbiAgICogQHJldHVybnMge3RoaXN9O1xuICAgKi9cbiAgYXBwZW5kKGl0ZW1zKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIGl0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIHRoaXMuaXRlbXMucHVzaChpdGVtKTtcbiAgICAgIGl0ZW0uYXBwZW5kZWQodGhpcyk7XG4gICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChpdGVtLmVsKTtcbiAgICB9KTtcbiAgICB0aGlzLmVsLmFwcGVuZENoaWxkKGZyYWdtZW50KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3t0b3A6IG51bWJlciwgbGVmdDogbnVtYmVyfX0gY3Vyc29yT2Zmc2V0XG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgc2V0T2Zmc2V0KGN1cnNvck9mZnNldCkge1xuICAgIHRoaXMuZWwuc3R5bGUudG9wID0gYCR7Y3Vyc29yT2Zmc2V0LnRvcH1weGA7XG4gICAgdGhpcy5lbC5zdHlsZS5sZWZ0ID0gYCR7Y3Vyc29yT2Zmc2V0LmxlZnR9cHhgO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNob3cgdGhlIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgc2hvdygpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24pIHtcbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICB0aGlzLnNob3duID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSGlkZSB0aGUgZWxlbWVudC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBoaWRlKCkge1xuICAgIGlmICh0aGlzLnNob3duKSB7XG4gICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICB0aGlzLnNob3duID0gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFyIHNlYXJjaCByZXN1bHRzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIGNsZWFyKCkge1xuICAgIHRoaXMuZWwuaW5uZXJIVE1MID0gJyc7XG4gICAgdGhpcy5pdGVtcy5mb3JFYWNoKChpdGVtKSA9PiB7IGl0ZW0uZmluYWxpemUoKTsgfSk7XG4gICAgdGhpcy5pdGVtcyA9IFtdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHRoZSBhY3RpdmUgaXRlbS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge0Ryb3Bkb3duSXRlbXx1bmRlZmluZWR9XG4gICAqL1xuICBnZXRBY3RpdmVJdGVtKCkge1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmZpbmQoKGl0ZW0pID0+IHsgcmV0dXJuIGl0ZW0uYWN0aXZlOyB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIG1vdmVBY3RpdmVJdGVtKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuc2hvd24pIHtcbiAgICAgIGxldCBhY3RpdmVJdGVtID0gdGhpcy5nZXRBY3RpdmVJdGVtKCk7XG4gICAgICBpZiAoYWN0aXZlSXRlbSkge1xuICAgICAgICBhY3RpdmVJdGVtLmRlYWN0aXZhdGUoKTtcbiAgICAgICAgY2FsbGJhY2soYWN0aXZlSXRlbVtuYW1lXS5hY3RpdmF0ZSgpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRHJvcGRvd247XG4iLCJpbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNvbnN0IEVOVEVSID0gMDtcbmV4cG9ydCBjb25zdCBVUCA9IDE7XG5leHBvcnQgY29uc3QgRE9XTiA9IDI7XG5cbi8qKlxuICogQWJzdHJhY3QgY2xhc3MgcmVwcmVzZW50aW5nIGEgZWRpdG9yIHRhcmdldC5cbiAqXG4gKiBAYWJzdHJhY3RcbiAqIEBleHRlbmRzIEV2ZW50RW1pdHRlclxuICovXG5jbGFzcyBFZGl0b3IgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAvKipcbiAgICogQGV2ZW50IEVkaXRvciNtb3ZlXG4gICAqIEB0eXBlIHtvYmplY3R9XG4gICAqIEBwcm9wIHtudW1iZXJ9IGNvZGVcbiAgICogQHByb3Age2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cblxuICAvKipcbiAgICogQGV2ZW50IEVkaXRvciNjaGFuZ2VcbiAgICogQHR5cGUge29iamVjdH1cbiAgICogQHByb3Age3N0cmluZ30gYmVmb3JlQ3Vyc29yXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAZXZlbnQgRWRpdG9yI2JsdXJcbiAgICovXG5cbiAgLyoqXG4gICAqIEl0IGlzIGNhbGxlZCB3aGVuIGEgc2VhcmNoIHJlc3VsdCBpcyBzZWxlY3RlZCBieSBhIHVzZXIuXG4gICAqXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0fSBfc2VhcmNoUmVzdWx0XG4gICAqL1xuICBhcHBseVNlYXJjaFJlc3VsdChfc2VhcmNoUmVzdWx0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGlucHV0IGN1cnNvcidzIGFic29sdXRlIGNvb3JkaW5hdGVzIGZyb20gdGhlIHdpbmRvdydzIGxlZnRcbiAgICogdG9wIGNvcm5lci4gSXQgaXMgaW50ZW5kZWQgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWIgY2xhc3Nlcy5cbiAgICpcbiAgICogQHR5cGUge29iamVjdH1cbiAgICogQHByb3Age251bWJlcn0gdG9wXG4gICAqIEBwcm9wIHtudW1iZXJ9IGxlZnRcbiAgICovXG4gIGdldCBjdXJzb3JPZmZzZXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRpdG9yO1xuIiwiaW1wb3J0IFNlYXJjaFJlc3VsdCBmcm9tICcuL3NlYXJjaC1yZXN1bHQnO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIG1hdGNoaW5nIGNvbmRpdGlvbiBiZXR3ZWVuIGEgU3RyYXRlZ3kgYW5kIGN1cnJlbnQgZWRpdG9yJ3MgdmFsdWUuXG4gKi9cbmNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l9IHN0cmF0ZWd5XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXJtXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IG1hdGNoXG4gICAqL1xuICBjb25zdHJ1Y3RvcihzdHJhdGVneSwgdGVybSwgbWF0Y2gpIHtcbiAgICB0aGlzLnN0cmF0ZWd5ID0gc3RyYXRlZ3k7XG4gICAgdGhpcy50ZXJtID0gdGVybTtcbiAgICB0aGlzLm1hdGNoID0gbWF0Y2g7XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlIHNlYXJjaCBzdHJhdGVneSBhbmQgY2FsbGJhY2sgdGhlIGdpdmVuIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBleGVjdXRlKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdHJhdGVneS5zZWFyY2goXG4gICAgICB0aGlzLnRlcm0sXG4gICAgICByZXN1bHRzID0+IHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0cy5tYXAocmVzdWx0ID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFNlYXJjaFJlc3VsdChyZXN1bHQsIHRoaXMudGVybSwgdGhpcy5zdHJhdGVneSk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0sXG4gICAgICB0aGlzLm1hdGNoXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBRdWVyeTtcbiIsImNsYXNzIFNlYXJjaFJlc3VsdCB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIEFuIGVsZW1lbnQgb2YgYXJyYXkgY2FsbGJhY2tlZCBieSBzZWFyY2ggZnVuY3Rpb24uXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXJtXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l9IHN0cmF0ZWd5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihkYXRhLCB0ZXJtLCBzdHJhdGVneSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgdGhpcy50ZXJtID0gdGVybTtcbiAgICB0aGlzLnN0cmF0ZWd5ID0gc3RyYXRlZ3k7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IGJlZm9yZUN1cnNvclxuICAgKiBAcGFyYW0ge3N0cmluZ30gYWZ0ZXJDdXJzb3JcbiAgICogQHJldHVybnMge3N0cmluZ1tdfHVuZGVmaW5lZH1cbiAgICovXG4gIHJlcGxhY2UoYmVmb3JlQ3Vyc29yLCBhZnRlckN1cnNvcikge1xuICAgIHZhciByZXBsYWNlbWVudCA9IHRoaXMuc3RyYXRlZ3kucmVwbGFjZSh0aGlzLmRhdGEpO1xuICAgIGlmIChyZXBsYWNlbWVudCAhPSBudWxsKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXBsYWNlbWVudCkpIHtcbiAgICAgICAgYWZ0ZXJDdXJzb3IgPSByZXBsYWNlbWVudFsxXSArIGFmdGVyQ3Vyc29yO1xuICAgICAgICByZXBsYWNlbWVudCA9IHJlcGxhY2VtZW50WzBdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFtiZWZvcmVDdXJzb3IucmVwbGFjZSh0aGlzLnN0cmF0ZWd5Lm1hdGNoLCByZXBsYWNlbWVudCksIGFmdGVyQ3Vyc29yXTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIHJlbmRlcigpIHtcbiAgICByZXR1cm4gdGhpcy5zdHJhdGVneS50ZW1wbGF0ZSh0aGlzLmRhdGEsIHRoaXMudGVybSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU2VhcmNoUmVzdWx0O1xuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gJy4vcXVlcnknO1xuXG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNmdW5jdGlvbic7XG5cbi8qKlxuICogRW5jYXBzdWxhdGUgYSBzaW5nbGUgc3RyYXRlZ3kuXG4gKi9cbmNsYXNzIFN0cmF0ZWd5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBwcm9wcyAtIEF0dHJpYnV0ZXMgb2YgdGhlIHN0cmF0ZWd5LlxuICAgKi9cbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgdGhpcy5wcm9wcy50ZW1wbGF0ZSB8fCAodGhpcy5wcm9wcy50ZW1wbGF0ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWU7IH0pO1xuICAgIHRoaXMuY2FjaGUgPSBwcm9wcy5jYWNoZSA/IHt9IDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFF1ZXJ5IG9iamVjdCBieSB0aGUgZ2l2ZW4gc3RyaW5nIGlmIHRoaXMgbWF0Y2hlcyB0byB0aGUgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIEhlYWQgdG8gaW5wdXQgY3Vyc29yLlxuICAgKiBAcmV0dXJucyB7P1F1ZXJ5fVxuICAgKi9cbiAgYnVpbGRRdWVyeSh0ZXh0KSB7XG4gICAgdmFyIG1hdGNoID0gdGV4dC5tYXRjaCh0aGlzLmdldE1hdGNoUmVnZXhwKHRleHQpKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBuZXcgUXVlcnkodGhpcywgbWF0Y2hbdGhpcy5pbmRleF0sIG1hdGNoKSA6IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRlcm1cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gbWF0Y2hcbiAgICovXG4gIHNlYXJjaCh0ZXJtLCBjYWxsYmFjaywgbWF0Y2gpIHtcbiAgICBpZiAodGhpcy5jYWNoZSkge1xuICAgICAgdGhpcy5zZWFyY2hXaXRoQ2FjaGUodGVybSwgY2FsbGJhY2ssIG1hdGNoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcm9wcy5zZWFyY2godGVybSwgY2FsbGJhY2ssIG1hdGNoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBBbiBlbGVtZW50IG9mIGFycmF5IGNhbGxiYWNrZWQgYnkgc2VhcmNoIGZ1bmN0aW9uLlxuICAgKiBAcmV0dXJucyB7c3RyaW5nW118c3RyaW5nfG51bGx9XG4gICAqL1xuICByZXBsYWNlKGRhdGEpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9wcy5yZXBsYWNlKGRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXJtXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IG1hdGNoXG4gICAqL1xuICBzZWFyY2hXaXRoQ2FjaGUodGVybSwgY2FsbGJhY2ssIG1hdGNoKSB7XG4gICAgdmFyIGNhY2hlID0gdGhpcy5jYWNoZVt0ZXJtXTtcbiAgICBpZiAoY2FjaGUpIHtcbiAgICAgIGNhbGxiYWNrKGNhY2hlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcm9wcy5zZWFyY2godGVybSwgcmVzdWx0cyA9PiB7XG4gICAgICAgIHRoaXMuY2FjaGVbdGVybV0gPSByZXN1bHRzO1xuICAgICAgICBjYWxsYmFjayhyZXN1bHRzKTtcbiAgICAgIH0sIG1hdGNoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHRcbiAgICogQHJldHVybnMge1JlZ0V4cH1cbiAgICovXG4gIGdldE1hdGNoUmVnZXhwKHRleHQpIHtcbiAgICByZXR1cm4gaXNGdW5jdGlvbih0aGlzLm1hdGNoKSA/IHRoaXMubWF0Y2godGV4dCkgOiB0aGlzLm1hdGNoO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtSZWdFeHB8RnVuY3Rpb259XG4gICAqL1xuICBnZXQgbWF0Y2goKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvcHMubWF0Y2g7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge051bWJlcn1cbiAgICovXG4gIGdldCBpbmRleCgpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9wcy5pbmRleCB8fCAyO1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtmdW5jdGlvbn1cbiAgICovXG4gIGdldCB0ZW1wbGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9wcy50ZW1wbGF0ZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTdHJhdGVneTtcbiIsImltcG9ydCBFZGl0b3IsIHtFTlRFUiwgVVAsIERPV059IGZyb20gJy4vZWRpdG9yJztcblxuY29uc3QgZ2V0Q2FyZXRDb29yZGluYXRlcyA9IHJlcXVpcmUoJ3RleHRhcmVhLWNhcmV0Jyk7XG5cbmNvbnN0IENBTExCQUNLX01FVEhPRFMgPSBbJ29uQmx1cicsICdvbktleWRvd24nLCAnb25LZXl1cCddO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIHRoZSB0YXJnZXQgdGV4dGFyZWEgZWxlbWVudC5cbiAqXG4gKiBAZXh0ZW5kcyBFZGl0b3JcbiAqL1xuY2xhc3MgVGV4dGFyZWEgZXh0ZW5kcyBFZGl0b3Ige1xuICAvKipcbiAgICogQHBhcmFtIHtIVE1MVGV4dEFyZWFFbGVtZW50fSBlbCAtIFdoZXJlIHRoZSB0ZXh0Y29tcGxldGUgd29ya3Mgb24uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihlbCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5lbCA9IGVsO1xuXG4gICAgLy8gQmluZCBjYWxsYmFjayBtZXRob2RzXG4gICAgQ0FMTEJBQ0tfTUVUSE9EUy5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgdGhpc1tuYW1lXSA9IHRoaXNbbmFtZV0uYmluZCh0aGlzKTtcbiAgICB9KTtcblxuICAgIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIHRoaXMub25CbHVyKTtcbiAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLm9uS2V5ZG93bik7XG4gICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMub25LZXl1cCk7XG4gIH1cblxuICAvKipcbiAgICogQG92ZXJyaWRlXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0fSBzZWFyY2hSZXN1bHRcbiAgICovXG4gIGFwcGx5U2VhcmNoUmVzdWx0KHNlYXJjaFJlc3VsdCkge1xuICAgIHZhciByZXBsYWNlID0gc2VhcmNoUmVzdWx0LnJlcGxhY2UodGhpcy5iZWZvcmVDdXJzb3IsIHRoaXMuYWZ0ZXJDdXJzb3IpO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHJlcGxhY2UpKSB7XG4gICAgICB0aGlzLmVsLnZhbHVlID0gcmVwbGFjZVswXSArIHJlcGxhY2VbMV07XG4gICAgICB0aGlzLmVsLnNlbGVjdGlvblN0YXJ0ID0gdGhpcy5lbC5zZWxlY3Rpb25FbmQgPSByZXBsYWNlWzBdLmxlbmd0aDtcbiAgICB9XG4gICAgdGhpcy5lbC5mb2N1cygpOyAvLyBDbGlja2luZyBhIGRyb3Bkb3duIGl0ZW0gcmVtb3ZlcyBmb2N1cyBmcm9tIHRoZSBlbGVtZW50LlxuICB9XG5cbiAgLyoqXG4gICAqIEBvdmVycmlkZVxuICAgKiBAcmV0dXJucyB7e3RvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXJ9fVxuICAgKi9cbiAgZ2V0IGN1cnNvck9mZnNldCgpIHtcbiAgICB2YXIgZWxPZmZzZXQgPSB0aGlzLmdldEVsT2Zmc2V0KCk7XG4gICAgdmFyIGVsU2Nyb2xsID0gdGhpcy5nZXRFbFNjcm9sbCgpO1xuICAgIHZhciBjdXJzb3JQb3NpdGlvbiA9IHRoaXMuZ2V0Q3Vyc29yUG9zaXRpb24oKTtcbiAgICByZXR1cm4ge1xuICAgICAgdG9wOiBlbE9mZnNldC50b3AgLSBlbFNjcm9sbC50b3AgKyBjdXJzb3JQb3NpdGlvbi50b3AgKyB0aGlzLmdldEVsTGluZUhlaWdodCgpLFxuICAgICAgbGVmdDogZWxPZmZzZXQubGVmdCAtIGVsU2Nyb2xsLmxlZnQgKyBjdXJzb3JQb3NpdGlvbi5sZWZ0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogVGhlIHN0cmluZyBmcm9tIGhlYWQgdG8gY3VycmVudCBpbnB1dCBjdXJzb3IgcG9zaXRpb24uXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAqL1xuICBnZXQgYmVmb3JlQ3Vyc29yKCkge1xuICAgIHJldHVybiB0aGlzLmVsLnZhbHVlLnN1YnN0cmluZygwLCB0aGlzLmVsLnNlbGVjdGlvbkVuZCk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIGdldCBhZnRlckN1cnNvcigpIHtcbiAgICByZXR1cm4gdGhpcy5lbC52YWx1ZS5zdWJzdHJpbmcodGhpcy5lbC5zZWxlY3Rpb25FbmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudCBjb29yZGluYXRlcyBvZiB0aGUgYCNlbGAgcmVsYXRpdmUgdG8gdGhlIGRvY3VtZW50LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7e3RvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXJ9fVxuICAgKi9cbiAgZ2V0RWxPZmZzZXQoKSB7XG4gICAgdmFyIHJlY3QgPSB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHZhciBkb2N1bWVudEVsZW1lbnQgPSB0aGlzLmVsLm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuICAgIHJldHVybiB7XG4gICAgICB0b3A6IHJlY3QudG9wIC0gZG9jdW1lbnRFbGVtZW50LmNsaWVudFRvcCxcbiAgICAgIGxlZnQ6IHJlY3QubGVmdCAtIGRvY3VtZW50RWxlbWVudC5jbGllbnRMZWZ0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3t0b3A6IG51bWJlciwgbGVmdDogbnVtYmVyfX1cbiAgICovXG4gIGdldEVsU2Nyb2xsKCkge1xuICAgIHJldHVybiB7IHRvcDogdGhpcy5lbC5zY3JvbGxUb3AsIGxlZnQ6IHRoaXMuZWwuc2Nyb2xsTGVmdCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBpbnB1dCBjdXJzb3IncyByZWxhdGl2ZSBjb29yZGluYXRlcyBmcm9tIHRoZSB0ZXh0YXJlYSdzIGxlZnRcbiAgICogdG9wIGNvcm5lci5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3t0b3A6IG51bWJlciwgbGVmdDogbnVtYmVyfX1cbiAgICovXG4gIGdldEN1cnNvclBvc2l0aW9uKCkge1xuICAgIC8vIHRleHRhcmVhLWNhcmV0IHRocm93cyBhbiBlcnJvciBpZiBgd2luZG93YCBpcyB1bmRlZmluZWQuXG4gICAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID9cbiAgICAgIGdldENhcmV0Q29vcmRpbmF0ZXModGhpcy5lbCwgdGhpcy5lbC5zZWxlY3Rpb25FbmQpIDogeyB0b3A6IDAsIGxlZnQ6IDAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgZ2V0RWxMaW5lSGVpZ2h0KCkge1xuICAgIHZhciBjb21wdXRlZCA9IGRvY3VtZW50LmRlZmF1bHRWaWV3LmdldENvbXB1dGVkU3R5bGUodGhpcy5lbCk7XG4gICAgdmFyIGxpbmVIZWlnaHQgPSBwYXJzZUludChjb21wdXRlZC5saW5lSGVpZ2h0LCAxMCk7XG4gICAgcmV0dXJuIGlzTmFOKGxpbmVIZWlnaHQpID8gcGFyc2VJbnQoY29tcHV0ZWQuZm9udFNpemUsIDEwKSA6IGxpbmVIZWlnaHQ7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQGZpcmVzIEVkaXRvciNibHVyXG4gICAqIEBwYXJhbSB7Rm9jdXNFdmVudH0gX2VcbiAgICovXG4gIG9uQmx1cihfZSkge1xuICAgIHRoaXMuZW1pdCgnYmx1cicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBmaXJlcyBFZGl0b3IjbW92ZVxuICAgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcbiAgICovXG4gIG9uS2V5ZG93bihlKSB7XG4gICAgdmFyIGNvZGUgPSB0aGlzLmdldENvZGUoZSk7XG4gICAgaWYgKGNvZGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZW1pdCgnbW92ZScsIHtcbiAgICAgICAgY29kZTogY29kZSxcbiAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQGZpcmVzIEVkaXRvciNjaGFuZ2VcbiAgICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBlXG4gICAqL1xuICBvbktleXVwKGUpIHtcbiAgICBpZiAoIXRoaXMuaXNNb3ZlS2V5RXZlbnQoZSkpIHtcbiAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgeyBiZWZvcmVDdXJzb3I6IHRoaXMuYmVmb3JlQ3Vyc29yIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqL1xuICBpc01vdmVLZXlFdmVudChlKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29kZShlKSAhPT0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcbiAgICogQHJldHVybnMge0VOVEVSfFVQfERPV058bnVsbH1cbiAgICovXG4gIGdldENvZGUoZSkge1xuICAgIHJldHVybiBlLmtleUNvZGUgPT09IDEzID8gRU5URVJcbiAgICAgICAgIDogZS5rZXlDb2RlID09PSAzOCA/IFVQXG4gICAgICAgICA6IGUua2V5Q29kZSA9PT0gNDAgPyBET1dOXG4gICAgICAgICA6IGUua2V5Q29kZSA9PT0gNzggJiYgZS5jdHJsS2V5ID8gRE9XTlxuICAgICAgICAgOiBlLmtleUNvZGUgPT09IDgwICYmIGUuY3RybEtleSA/IFVQXG4gICAgICAgICA6IG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGV4dGFyZWE7XG4iLCJpbXBvcnQgQ29tcGxldGVyIGZyb20gJy4vY29tcGxldGVyJztcbmltcG9ydCBEcm9wZG93biBmcm9tICcuL2Ryb3Bkb3duJztcbmltcG9ydCBTdHJhdGVneSBmcm9tICcuL3N0cmF0ZWd5JztcbmltcG9ydCB7RU5URVIsIFVQLCBET1dOfSBmcm9tICcuL2VkaXRvcic7XG5pbXBvcnQge2xvY2t9IGZyb20gJy4vdXRpbHMnO1xuaW1wb3J0IGlzRnVuY3Rpb24gZnJvbSAnbG9kYXNoLmlzZnVuY3Rpb24nO1xuXG5jb25zdCBDQUxMQkFDS19NRVRIT0RTID0gW1xuICAnaGFuZGxlQmx1cicsXG4gICdoYW5kbGVDaGFuZ2UnLFxuICAnaGFuZGxlSGl0JyxcbiAgJ2hhbmRsZU1vdmUnLFxuICAnaGFuZGxlU2VsZWN0Jyxcbl07XG5cbi8qKlxuICogVGhlIGNvcmUgb2YgdGV4dGNvbXBsZXRlLiBJdCBhY3RzIGFzIGEgbWVkaWF0b3IuXG4gKi9cbmNsYXNzIFRleHRjb21wbGV0ZSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge0VkaXRvcn0gZWRpdG9yIC0gV2hlcmUgdGhlIHRleHRjb21wbGV0ZSB3b3JrcyBvbi5cbiAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnNcbiAgICovXG4gIGNvbnN0cnVjdG9yKGVkaXRvciwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5jb21wbGV0ZXIgPSBuZXcgQ29tcGxldGVyKCk7XG4gICAgdGhpcy5kcm9wZG93biA9IG5ldyBEcm9wZG93bihvcHRpb25zLmRyb3Bkb3duIHx8IHt9KTtcbiAgICB0aGlzLmVkaXRvciA9IGVkaXRvcjtcblxuICAgIC8vIEJpbmQgY2FsbGJhY2sgbWV0aG9kc1xuICAgIENBTExCQUNLX01FVEhPRFMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdLmJpbmQodGhpcyk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmxvY2thYmxlVHJpZ2dlciA9IGxvY2soZnVuY3Rpb24gKGZyZWUsIHRleHQpIHtcbiAgICAgIHRoaXMuZnJlZSA9IGZyZWU7XG4gICAgICB0aGlzLmNvbXBsZXRlci5ydW4odGV4dCk7XG4gICAgfSk7XG5cbiAgICB0aGlzLnN0YXJ0TGlzdGVuaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQHB1YmxpY1xuICAgKiBAcGFyYW0ge09iamVjdFtdfSBzdHJhdGVneVByb3BzQXJyYXlcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqIEBleGFtcGxlXG4gICAqIHRleHRjb21wbGV0ZS5yZWdpc3Rlcihbe1xuICAgKiAgIG1hdGNoOiAvKF58XFxzKShcXHcrKSQvLFxuICAgKiAgIHNlYXJjaDogZnVuY3Rpb24gKHRlcm0sIGNhbGxiYWNrKSB7XG4gICAqICAgICAkLmFqYXgoeyAuLi4gfSlcbiAgICogICAgICAgLmRvbmUoY2FsbGJhY2spXG4gICAqICAgICAgIC5mYWlsKFtdKTtcbiAgICogICB9LFxuICAgKiAgIHJlcGxhY2U6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgKiAgICAgcmV0dXJuICckMScgKyB2YWx1ZSArICcgJztcbiAgICogICB9XG4gICAqIH1dKTtcbiAgICovXG4gIHJlZ2lzdGVyKHN0cmF0ZWd5UHJvcHNBcnJheSkge1xuICAgIHN0cmF0ZWd5UHJvcHNBcnJheS5mb3JFYWNoKChwcm9wcykgPT4ge1xuICAgICAgdGhpcy5jb21wbGV0ZXIucmVnaXN0ZXJTdHJhdGVneShuZXcgU3RyYXRlZ3kocHJvcHMpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhdXRvY29tcGxldGluZy5cbiAgICpcbiAgICogQHB1YmxpY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIEhlYWQgdG8gaW5wdXQgY3Vyc29yLlxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICogQGxpc3RlbnMgRWRpdG9yI2NoYW5nZVxuICAgKi9cbiAgdHJpZ2dlcih0ZXh0KSB7XG4gICAgdGhpcy5sb2NrYWJsZVRyaWdnZXIodGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogVW5sb2NrIHRyaWdnZXIgbWV0aG9kLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIHVubG9jaygpIHtcbiAgICAvLyBDYWxsaW5nIGZyZWUgZnVuY3Rpb24gbWF5IGFzc2lnbiBhIG5ldyBmdW5jdGlvbiB0byBgdGhpcy5mcmVlYC5cbiAgICAvLyBJdCBkZXBlbmRzIG9uIHdoZXRoZXIgZXh0cmEgZnVuY3Rpb24gY2FsbCB3YXMgbWFkZSBvciBub3QuXG4gICAgdmFyIGZyZWUgPSB0aGlzLmZyZWU7XG4gICAgdGhpcy5mcmVlID0gbnVsbDtcbiAgICBpZiAoaXNGdW5jdGlvbihmcmVlKSkgeyBmcmVlKCk7IH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdFtdfSBzZWFyY2hSZXN1bHRzXG4gICAqIEBsaXN0ZW5zIENvbXBsZXRlciNoaXRcbiAgICovXG4gIGhhbmRsZUhpdCh7c2VhcmNoUmVzdWx0c30pIHtcbiAgICBpZiAoc2VhcmNoUmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZHJvcGRvd24ucmVuZGVyKHNlYXJjaFJlc3VsdHMsIHRoaXMuZWRpdG9yLmN1cnNvck9mZnNldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZHJvcGRvd24uZGVhY3RpdmF0ZSgpO1xuICAgIH1cbiAgICB0aGlzLnVubG9jaygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7RU5URVJ8VVB8RE9XTn0gY29kZVxuICAgKiBAcGFyYW0ge2Z1bmNpb259IGNhbGxiYWNrXG4gICAqIEBsaXN0ZW5zIEVkaXRvciNtb3ZlXG4gICAqL1xuICBoYW5kbGVNb3ZlKHtjb2RlLCBjYWxsYmFja30pIHtcbiAgICB2YXIgbWV0aG9kID0gY29kZSA9PT0gRU5URVIgPyAnc2VsZWN0QWN0aXZlSXRlbSdcbiAgICAgICAgICAgICAgIDogY29kZSA9PT0gVVAgPyAndXAnXG4gICAgICAgICAgICAgICA6IGNvZGUgPT09IERPV04gPyAnZG93bidcbiAgICAgICAgICAgICAgIDogbnVsbDtcbiAgICBpZiAoY29kZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5kcm9wZG93blttZXRob2RdKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGJlZm9yZUN1cnNvclxuICAgKiBAbGlzdGVucyBFZGl0b3IjY2hhbmdlXG4gICAqL1xuICBoYW5kbGVDaGFuZ2Uoe2JlZm9yZUN1cnNvcn0pIHtcbiAgICB0aGlzLnRyaWdnZXIoYmVmb3JlQ3Vyc29yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbGlzdGVucyBFZGl0b3IjYmx1clxuICAgKi9cbiAgaGFuZGxlQmx1cigpIHtcbiAgICB0aGlzLmRyb3Bkb3duLmRlYWN0aXZhdGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdH0gc2VhcmNoUmVzdWx0XG4gICAqIEBsaXN0ZW5zIERyb3Bkb3duI3NlbGVjdFxuICAgKi9cbiAgaGFuZGxlU2VsZWN0KHtzZWFyY2hSZXN1bHR9KSB7XG4gICAgdGhpcy5lZGl0b3IuYXBwbHlTZWFyY2hSZXN1bHQoc2VhcmNoUmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhcnRMaXN0ZW5pbmcoKSB7XG4gICAgdGhpcy5lZGl0b3Iub24oJ21vdmUnLCB0aGlzLmhhbmRsZU1vdmUpXG4gICAgICAgICAgICAgICAub24oJ2NoYW5nZScsIHRoaXMuaGFuZGxlQ2hhbmdlKVxuICAgICAgICAgICAgICAgLm9uKCdibHVyJywgdGhpcy5oYW5kbGVCbHVyKTtcbiAgICB0aGlzLmRyb3Bkb3duLm9uKCdzZWxlY3QnLCB0aGlzLmhhbmRsZVNlbGVjdCk7XG4gICAgdGhpcy5jb21wbGV0ZXIub24oJ2hpdCcsIHRoaXMuaGFuZGxlSGl0KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUZXh0Y29tcGxldGU7XG4iLCIvKipcbiAqIEV4Y2x1c2l2ZSBleGVjdXRpb24gY29udHJvbCB1dGlsaXR5LlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gYmUgbG9ja2VkLiBJdCBpcyBleGVjdXRlZCB3aXRoIGFcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBuYW1lZCBgZnJlZWAgYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiBPbmNlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgaXMgY2FsbGVkLCBhZGRpdGlvbmFsIGV4ZWN1dGlvbiBhcmUgaWdub3JlZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgIHVudGlsIHRoZSBmcmVlIGlzIGludm9rZWQuIFRoZW4gdGhlIGxhc3QgaWdub3JlZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWN1dGlvbiB3aWxsIGJlIHJlcGxheWVkIGltbWVkaWF0ZWx5LlxuICogQGV4YW1wbGVcbiAqIHZhciBsb2NrZWRGdW5jID0gbG9jayhmdW5jdGlvbiAoZnJlZSkge1xuICogICBzZXRUaW1lb3V0KGZ1bmN0aW9uIHsgZnJlZSgpOyB9LCAxMDAwKTsgLy8gSXQgd2lsbCBiZSBmcmVlIGluIDEgc2VjLlxuICogICBjb25zb2xlLmxvZygnSGVsbG8sIHdvcmxkJyk7XG4gKiB9KTtcbiAqIGxvY2tlZEZ1bmMoKTsgIC8vID0+ICdIZWxsbywgd29ybGQnXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyBub25lXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyBub25lXG4gKiAvLyAxIHNlYyBwYXN0IHRoZW5cbiAqIC8vID0+ICdIZWxsbywgd29ybGQnXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyA9PiAnSGVsbG8sIHdvcmxkJ1xuICogbG9ja2VkRnVuYygpOyAgLy8gbm9uZVxuICogQHJldHVybnMge2Z1bmN0aW9ufSBBIHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2NrKGZ1bmMpIHtcbiAgdmFyIGxvY2tlZCwgcXVldWVkQXJnc1RvUmVwbGF5O1xuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gQ29udmVydCBhcmd1bWVudHMgaW50byBhIHJlYWwgYXJyYXkuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIGlmIChsb2NrZWQpIHtcbiAgICAgIC8vIEtlZXAgYSBjb3B5IG9mIHRoaXMgYXJndW1lbnQgbGlzdCB0byByZXBsYXkgbGF0ZXIuXG4gICAgICAvLyBPSyB0byBvdmVyd3JpdGUgYSBwcmV2aW91cyB2YWx1ZSBiZWNhdXNlIHdlIG9ubHkgcmVwbGF5XG4gICAgICAvLyB0aGUgbGFzdCBvbmUuXG4gICAgICBxdWV1ZWRBcmdzVG9SZXBsYXkgPSBhcmdzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsb2NrZWQgPSB0cnVlO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiByZXBsYXlPckZyZWUoKSB7XG4gICAgICBpZiAocXVldWVkQXJnc1RvUmVwbGF5KSB7XG4gICAgICAgIC8vIE90aGVyIHJlcXVlc3QocykgYXJyaXZlZCB3aGlsZSB3ZSB3ZXJlIGxvY2tlZC5cbiAgICAgICAgLy8gTm93IHRoYXQgdGhlIGxvY2sgaXMgYmVjb21pbmcgYXZhaWxhYmxlLCByZXBsYXlcbiAgICAgICAgLy8gdGhlIGxhdGVzdCBzdWNoIHJlcXVlc3QsIHRoZW4gY2FsbCBiYWNrIGhlcmUgdG9cbiAgICAgICAgLy8gdW5sb2NrIChvciByZXBsYXkgYW5vdGhlciByZXF1ZXN0IHRoYXQgYXJyaXZlZFxuICAgICAgICAvLyB3aGlsZSB0aGlzIG9uZSB3YXMgaW4gZmxpZ2h0KS5cbiAgICAgICAgdmFyIHJlcGxheUFyZ3MgPSBxdWV1ZWRBcmdzVG9SZXBsYXk7XG4gICAgICAgIHF1ZXVlZEFyZ3NUb1JlcGxheSA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmVwbGF5QXJncy51bnNoaWZ0KHJlcGxheU9yRnJlZSk7XG4gICAgICAgIGZ1bmMuYXBwbHkoc2VsZiwgcmVwbGF5QXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NrZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXJncy51bnNoaWZ0KHJlcGxheU9yRnJlZSk7XG4gICAgZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbn1cbiJdfQ==
