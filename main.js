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
 * lodash 4.0.4 (Custom Build) <https://lodash.com/>
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
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
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

},{"lodash.keysin":3,"lodash.rest":4}],3:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

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
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
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
      proto = (isFunction(Ctor) && Ctor.prototype) || objectProto;

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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var stringTag = '[object String]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type Function
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

module.exports = isString;

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
exports.CLASS_NAME = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash.uniqueid');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CLASS_NAME = exports.CLASS_NAME = 'textcomplete-item';
var ACTIVE_CLASS_NAME = CLASS_NAME + ' active';
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
        this.el.className = CLASS_NAME;
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
        li.className = this.active ? ACTIVE_CLASS_NAME : CLASS_NAME;
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

var _utils = require('./utils');

var _lodash = require('lodash.assignin');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.uniqueid');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.isfunction');

var _lodash6 = _interopRequireDefault(_lodash5);

var _events = require('events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DEFAULT_CLASS_NAME = 'dropdown-menu textcomplete-dropdown';

/**
 * @typedef {Object} Dropdown~Offset
 * @prop {number} [top]
 * @prop {number} [left]
 * @prop {number} [right]
 */

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
      el.id = (0, _lodash4.default)('textcomplete-dropdown-');
      (0, _lodash2.default)(el.style, {
        display: 'none',
        position: 'absolute',
        zIndex: 10000
      });
      document.body.appendChild(el);
      return el;
    }

    /**
     * @param {string} [className=DEFAULT_CLASS_NAME] - The class attribute of the el.
     * @param {function|string} [footer]
     * @param {function|string} [header]
     * @param {number} [maxCount=10]
     * @param {Object} [style] - The style of the el.
     */

  }]);

  function Dropdown(_ref) {
    var _ref$className = _ref.className;
    var className = _ref$className === undefined ? DEFAULT_CLASS_NAME : _ref$className;
    var footer = _ref.footer;
    var header = _ref.header;
    var _ref$maxCount = _ref.maxCount;
    var maxCount = _ref$maxCount === undefined ? 10 : _ref$maxCount;
    var style = _ref.style;

    _classCallCheck(this, Dropdown);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Dropdown).call(this));

    _this.shown = false;
    _this.items = [];
    _this.footer = footer;
    _this.header = header;
    _this.maxCount = maxCount;
    _this.el.className = className;
    if (style) {
      (0, _lodash2.default)(_this.el.style, style);
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
     * @param {Dropdown~Offset} cursorOffset
     * @returns {this}
     */
    value: function render(searchResults, cursorOffset) {
      var _this2 = this;

      var rawResults = [],
          dropdownItems = [];
      searchResults.forEach(function (searchResult) {
        rawResults.push(searchResult.data);
        if (dropdownItems.length < _this2.maxCount) {
          dropdownItems.push(new _dropdownItem2.default(searchResult));
        }
      });
      this.clear().renderEdge(rawResults, 'header').append(dropdownItems).renderEdge(rawResults, 'footer');
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
      var _this3 = this;

      var fragment = document.createDocumentFragment();
      items.forEach(function (item) {
        _this3.items.push(item);
        item.appended(_this3);
        fragment.appendChild(item.el);
      });
      this.el.appendChild(fragment);
      return this;
    }

    /**
     * @private
     * @param {Dropdown~Offset} cursorOffset
     * @returns {this}
     */

  }, {
    key: 'setOffset',
    value: function setOffset(cursorOffset) {
      var _this4 = this;

      ['top', 'right', 'bottom', 'left'].forEach(function (name) {
        if (cursorOffset.hasOwnProperty(name)) {
          _this4.el.style[name] = cursorOffset[name] + 'px';
        }
      });
      return this;
    }

    /**
     * Show the element.
     *
     * @private
     * @returns {this}
     * @fires Dropdown#show
     * @fires Dropdown#shown
     * @fires Dropdown#rendered
     */

  }, {
    key: 'show',
    value: function show() {
      if (!this.shown) {
        /** @event Dropdown#show */
        this.emit('show');
        this.el.style.display = 'block';
        this.shown = true;
        /** @event Dropdown#shown */
        this.emit('shown');
      }
      /** @event Dropdown#rendered */
      this.emit('rendered');
      return this;
    }

    /**
     * Hide the element.
     *
     * @private
     * @returns {this}
     * @fires Dropdown#hide
     * @fires Dropdown#hidden
     */

  }, {
    key: 'hide',
    value: function hide() {
      if (this.shown) {
        /** @event Dropdown#hide */
        this.emit('hide');
        this.el.style.display = 'none';
        this.shown = false;
        /** @event Dropdown#hidden */
        this.emit('hidden');
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

    /**
     * @private
     * @param {object[]} rawResults - What callbacked by search function.
     * @param {string} type - 'header' or 'footer'.
     * @returns {this}
     */

  }, {
    key: 'renderEdge',
    value: function renderEdge(rawResults, type) {
      var source = this[type];
      if (source) {
        var content = (0, _lodash6.default)(source) ? source(rawResults) : source;
        var fragment = (0, _utils.createFragment)('<li class="textcomplete-' + type + '">' + content + '</li>');
        this.el.appendChild(fragment);
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

},{"./dropdown-item":12,"./utils":20,"events":1,"lodash.assignin":2,"lodash.isfunction":5,"lodash.uniqueid":7}],14:[function(require,module,exports){
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
     * @type {Dropdown~Offset}
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

var _lodash3 = require('lodash.isstring');

var _lodash4 = _interopRequireDefault(_lodash3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_INDEX = 2;

function DEFAULT_TEMPLATE(value) {
  return value;
}

/**
 * Properties of the strategy.
 *
 * @typedef {Object} Strategy~Properties
 * @prop {regexp|function} match - If it is a function, it must return a RegExp.
 * @prop {function} search
 * @prop {function} replace
 * @prop {function} [context]
 * @prop {function} [template]
 * @prop {boolean} [cache]
 * @prop {number} [index=2]
 */

/**
 * Encapsulate a single strategy.
 *
 * @prop {Strategy~Properties} props - Its properties.
 */

var Strategy = function () {
  /**
   * @param {Strategy~Properties} props
   */

  function Strategy(props) {
    _classCallCheck(this, Strategy);

    this.props = props;
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
      if ((0, _lodash2.default)(this.props.context)) {
        var context = this.props.context(text);
        if ((0, _lodash4.default)(context)) {
          text = context;
        } else if (!context) {
          return null;
        }
      }
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
      return this.props.index || DEFAULT_INDEX;
    }

    /**
     * @returns {function}
     */

  }, {
    key: 'template',
    get: function get() {
      return this.props.template || DEFAULT_TEMPLATE;
    }
  }]);

  return Strategy;
}();

exports.default = Strategy;

},{"./query":15,"lodash.isfunction":5,"lodash.isstring":6}],18:[function(require,module,exports){
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
 * @prop {HTMLTextAreaElement} el - Where the textcomplete works on.
 */

var Textarea = function (_Editor) {
  _inherits(Textarea, _Editor);

  /**
   * @param {HTMLTextAreaElement} el
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
      var top = elOffset.top - elScroll.top + cursorPosition.top + this.getElLineHeight();
      var left = elOffset.left - elScroll.left + cursorPosition.left;
      if (this.el.dir !== 'rtl') {
        return { top: top, left: left };
      } else {
        return { top: top, right: document.documentElement.clientWidth - left };
      }
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

var _events = require('events');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CALLBACK_METHODS = ['handleBlur', 'handleChange', 'handleHit', 'handleMove', 'handleSelect'];

/**
 * The core of textcomplete. It acts as a mediator.
 *
 * @prop {Completer} completer
 * @prop {Dropdown} dropdown
 * @prop {Editor} editor
 * @extends EventEmitter
 */

var Textcomplete = function (_EventEmitter) {
  _inherits(Textcomplete, _EventEmitter);

  /**
   * @param {Editor} editor - Where the textcomplete works on.
   * @param {object} options
   */

  function Textcomplete(editor) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Textcomplete);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Textcomplete).call(this));

    _this.completer = new _completer2.default();
    _this.dropdown = new _dropdown2.default(options.dropdown || {});
    _this.editor = editor;
    _this.options = options;

    // Bind callback methods
    CALLBACK_METHODS.forEach(function (name) {
      _this[name] = _this[name].bind(_this);
    });

    _this.lockableTrigger = (0, _utils.lock)(function (free, text) {
      this.free = free;
      this.completer.run(text);
    });

    _this.startListening();
    return _this;
  }

  /**
   * @public
   * @param {Strategy~Properties[]} strategyPropsArray
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

    /** @event Textcomplete#show */
    /** @event Textcomplete#shown */
    /** @event Textcomplete#rendered */
    /** @event Textcomplete#hide */
    /** @event Textcomplete#hidden */

    /**
     * @private
     * @param {string} eventName
     * @returns {function}
     */

  }, {
    key: 'buildHandler',
    value: function buildHandler(eventName) {
      var _this3 = this;

      return function () {
        _this3.emit(eventName);
      };
    }

    /**
     * @private
     */

  }, {
    key: 'startListening',
    value: function startListening() {
      this.editor.on('move', this.handleMove).on('change', this.handleChange).on('blur', this.handleBlur);
      this.dropdown.on('select', this.handleSelect).on('show', this.buildHandler('show')).on('shown', this.buildHandler('shown')).on('rendered', this.buildHandler('rendered')).on('hide', this.buildHandler('hide')).on('hidden', this.buildHandler('hidden'));
      this.completer.on('hit', this.handleHit);
    }
  }]);

  return Textcomplete;
}(_events.EventEmitter);

exports.default = Textcomplete;

},{"./completer":10,"./dropdown":13,"./editor":14,"./strategy":17,"./utils":20,"events":1,"lodash.isfunction":5}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lock = lock;
exports.createFragment = createFragment;
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

/**
 * Create a document fragment by the given HTML string.
 *
 * @param {string} tagString
 * @returns {DocumentFragment}
 */
function createFragment(tagString) {
  // TODO Imprement with Range#createContextualFragment when it drops IE9 support.
  var div = document.createElement('div');
  div.innerHTML = tagString;
  var childNodes = div.childNodes;
  var fragment = document.createDocumentFragment();
  for (var i = 0, l = childNodes.length; i < l; i++) {
    fragment.appendChild(childNodes[i]);
  }
  return fragment;
}

},{}]},{},[11])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduaW4vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbmluL25vZGVfbW9kdWxlcy9sb2Rhc2gua2V5c2luL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ25pbi9ub2RlX21vZHVsZXMvbG9kYXNoLnJlc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzZnVuY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzc3RyaW5nL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC51bmlxdWVpZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gudW5pcXVlaWQvbm9kZV9tb2R1bGVzL2xvZGFzaC50b3N0cmluZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90ZXh0YXJlYS1jYXJldC9pbmRleC5qcyIsInNyYy9jb21wbGV0ZXIuanMiLCJzcmMvZG9jL21haW4uanMiLCJzcmMvZHJvcGRvd24taXRlbS5qcyIsInNyYy9kcm9wZG93bi5qcyIsInNyYy9lZGl0b3IuanMiLCJzcmMvcXVlcnkuanMiLCJzcmMvc2VhcmNoLXJlc3VsdC5qcyIsInNyYy9zdHJhdGVneS5qcyIsInNyYy90ZXh0YXJlYS5qcyIsInNyYy90ZXh0Y29tcGxldGUuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN2VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QUFnQixTQUFoQixDQUh3QztBQUl4QyxNQUFJLGFBQWEsSUFBSSxVQUFKLENBSnVCO0FBS3hDLE1BQUksV0FBVyxTQUFTLHNCQUFULEVBQVgsQ0FMb0M7QUFNeEMsT0FBSyxJQUFJLElBQUksQ0FBSixFQUFPLElBQUksV0FBVyxNQUFYLEVBQW1CLElBQUksQ0FBSixFQUFPLEdBQTlDLEVBQW1EO0FBQ2pELGFBQVMsV0FBVCxDQUFxQixXQUFXLENBQVgsQ0FBckIsRUFEaUQ7R0FBbkQ7QUFHQSxTQUFPLFFBQVAsQ0FUd0M7Q0FBbkMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLyoqXG4gKiBsb2Rhc2ggNC4wLjQgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xudmFyIGtleXNJbiA9IHJlcXVpcmUoJ2xvZGFzaC5rZXlzaW4nKSxcbiAgICByZXN0ID0gcmVxdWlyZSgnbG9kYXNoLnJlc3QnKTtcblxuLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgdW5zaWduZWQgaW50ZWdlciB2YWx1ZXMuICovXG52YXIgcmVJc1VpbnQgPSAvXig/OjB8WzEtOV1cXGQqKSQvO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBpbmRleC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aD1NQVhfU0FGRV9JTlRFR0VSXSBUaGUgdXBwZXIgYm91bmRzIG9mIGEgdmFsaWQgaW5kZXguXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGluZGV4LCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSW5kZXgodmFsdWUsIGxlbmd0aCkge1xuICB2YWx1ZSA9ICh0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgfHwgcmVJc1VpbnQudGVzdCh2YWx1ZSkpID8gK3ZhbHVlIDogLTE7XG4gIGxlbmd0aCA9IGxlbmd0aCA9PSBudWxsID8gTUFYX1NBRkVfSU5URUdFUiA6IGxlbmd0aDtcbiAgcmV0dXJuIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPCBsZW5ndGg7XG59XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQXNzaWducyBgdmFsdWVgIHRvIGBrZXlgIG9mIGBvYmplY3RgIGlmIHRoZSBleGlzdGluZyB2YWx1ZSBpcyBub3QgZXF1aXZhbGVudFxuICogdXNpbmcgW2BTYW1lVmFsdWVaZXJvYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtc2FtZXZhbHVlemVybylcbiAqIGZvciBlcXVhbGl0eSBjb21wYXJpc29ucy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gYXNzaWduLlxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gYXNzaWduLlxuICovXG5mdW5jdGlvbiBhc3NpZ25WYWx1ZShvYmplY3QsIGtleSwgdmFsdWUpIHtcbiAgdmFyIG9ialZhbHVlID0gb2JqZWN0W2tleV07XG4gIGlmICghKGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpICYmIGVxKG9ialZhbHVlLCB2YWx1ZSkpIHx8XG4gICAgICAodmFsdWUgPT09IHVuZGVmaW5lZCAmJiAhKGtleSBpbiBvYmplY3QpKSkge1xuICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5wcm9wZXJ0eWAgd2l0aG91dCBzdXBwb3J0IGZvciBkZWVwIHBhdGhzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRoZSBrZXkgb2YgdGhlIHByb3BlcnR5IHRvIGdldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBiYXNlUHJvcGVydHkoa2V5KSB7XG4gIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0ID09IG51bGwgPyB1bmRlZmluZWQgOiBvYmplY3Rba2V5XTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDb3BpZXMgcHJvcGVydGllcyBvZiBgc291cmNlYCB0byBgb2JqZWN0YC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyBmcm9tLlxuICogQHBhcmFtIHtBcnJheX0gcHJvcHMgVGhlIHByb3BlcnR5IG5hbWVzIHRvIGNvcHkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29iamVjdD17fV0gVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgdG8uXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICovXG5mdW5jdGlvbiBjb3B5T2JqZWN0KHNvdXJjZSwgcHJvcHMsIG9iamVjdCkge1xuICByZXR1cm4gY29weU9iamVjdFdpdGgoc291cmNlLCBwcm9wcywgb2JqZWN0KTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGxpa2UgYGNvcHlPYmplY3RgIGV4Y2VwdCB0aGF0IGl0IGFjY2VwdHMgYSBmdW5jdGlvbiB0b1xuICogY3VzdG9taXplIGNvcGllZCB2YWx1ZXMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgZnJvbS5cbiAqIEBwYXJhbSB7QXJyYXl9IHByb3BzIFRoZSBwcm9wZXJ0eSBuYW1lcyB0byBjb3B5LlxuICogQHBhcmFtIHtPYmplY3R9IFtvYmplY3Q9e31dIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIHRvLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2N1c3RvbWl6ZXJdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgY29waWVkIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGNvcHlPYmplY3RXaXRoKHNvdXJjZSwgcHJvcHMsIG9iamVjdCwgY3VzdG9taXplcikge1xuICBvYmplY3QgfHwgKG9iamVjdCA9IHt9KTtcblxuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIGxlbmd0aCA9IHByb3BzLmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XG5cbiAgICB2YXIgbmV3VmFsdWUgPSBjdXN0b21pemVyXG4gICAgICA/IGN1c3RvbWl6ZXIob2JqZWN0W2tleV0sIHNvdXJjZVtrZXldLCBrZXksIG9iamVjdCwgc291cmNlKVxuICAgICAgOiBzb3VyY2Vba2V5XTtcblxuICAgIGFzc2lnblZhbHVlKG9iamVjdCwga2V5LCBuZXdWYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gbGlrZSBgXy5hc3NpZ25gLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhc3NpZ25lciBUaGUgZnVuY3Rpb24gdG8gYXNzaWduIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGFzc2lnbmVyIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBjcmVhdGVBc3NpZ25lcihhc3NpZ25lcikge1xuICByZXR1cm4gcmVzdChmdW5jdGlvbihvYmplY3QsIHNvdXJjZXMpIHtcbiAgICB2YXIgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gc291cmNlcy5sZW5ndGgsXG4gICAgICAgIGN1c3RvbWl6ZXIgPSBsZW5ndGggPiAxID8gc291cmNlc1tsZW5ndGggLSAxXSA6IHVuZGVmaW5lZCxcbiAgICAgICAgZ3VhcmQgPSBsZW5ndGggPiAyID8gc291cmNlc1syXSA6IHVuZGVmaW5lZDtcblxuICAgIGN1c3RvbWl6ZXIgPSB0eXBlb2YgY3VzdG9taXplciA9PSAnZnVuY3Rpb24nXG4gICAgICA/IChsZW5ndGgtLSwgY3VzdG9taXplcilcbiAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKGd1YXJkICYmIGlzSXRlcmF0ZWVDYWxsKHNvdXJjZXNbMF0sIHNvdXJjZXNbMV0sIGd1YXJkKSkge1xuICAgICAgY3VzdG9taXplciA9IGxlbmd0aCA8IDMgPyB1bmRlZmluZWQgOiBjdXN0b21pemVyO1xuICAgICAgbGVuZ3RoID0gMTtcbiAgICB9XG4gICAgb2JqZWN0ID0gT2JqZWN0KG9iamVjdCk7XG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcbiAgICAgIHZhciBzb3VyY2UgPSBzb3VyY2VzW2luZGV4XTtcbiAgICAgIGlmIChzb3VyY2UpIHtcbiAgICAgICAgYXNzaWduZXIob2JqZWN0LCBzb3VyY2UsIGluZGV4LCBjdXN0b21pemVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfSk7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIHZhbHVlIGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBpbmRleCBUaGUgcG90ZW50aWFsIGl0ZXJhdGVlIGluZGV4IG9yIGtleSBhcmd1bWVudC5cbiAqIEBwYXJhbSB7Kn0gb2JqZWN0IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgb2JqZWN0IGFyZ3VtZW50LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBhcmd1bWVudHMgYXJlIGZyb20gYW4gaXRlcmF0ZWUgY2FsbCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0l0ZXJhdGVlQ2FsbCh2YWx1ZSwgaW5kZXgsIG9iamVjdCkge1xuICBpZiAoIWlzT2JqZWN0KG9iamVjdCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIHR5cGUgPSB0eXBlb2YgaW5kZXg7XG4gIGlmICh0eXBlID09ICdudW1iZXInXG4gICAgICA/IChpc0FycmF5TGlrZShvYmplY3QpICYmIGlzSW5kZXgoaW5kZXgsIG9iamVjdC5sZW5ndGgpKVxuICAgICAgOiAodHlwZSA9PSAnc3RyaW5nJyAmJiBpbmRleCBpbiBvYmplY3QpKSB7XG4gICAgcmV0dXJuIGVxKG9iamVjdFtpbmRleF0sIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBbYFNhbWVWYWx1ZVplcm9gXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1zYW1ldmFsdWV6ZXJvKVxuICogY29tcGFyaXNvbiBiZXR3ZWVuIHR3byB2YWx1ZXMgdG8gZGV0ZXJtaW5lIGlmIHRoZXkgYXJlIGVxdWl2YWxlbnQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb21wYXJlLlxuICogQHBhcmFtIHsqfSBvdGhlciBUaGUgb3RoZXIgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIHZhciBvYmplY3QgPSB7ICd1c2VyJzogJ2ZyZWQnIH07XG4gKiB2YXIgb3RoZXIgPSB7ICd1c2VyJzogJ2ZyZWQnIH07XG4gKlxuICogXy5lcShvYmplY3QsIG9iamVjdCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcShvYmplY3QsIG90aGVyKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcSgnYScsICdhJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5lcSgnYScsIE9iamVjdCgnYScpKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5lcShOYU4sIE5hTik7XG4gKiAvLyA9PiB0cnVlXG4gKi9cbmZ1bmN0aW9uIGVxKHZhbHVlLCBvdGhlcikge1xuICByZXR1cm4gdmFsdWUgPT09IG90aGVyIHx8ICh2YWx1ZSAhPT0gdmFsdWUgJiYgb3RoZXIgIT09IG90aGVyKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLiBBIHZhbHVlIGlzIGNvbnNpZGVyZWQgYXJyYXktbGlrZSBpZiBpdCdzXG4gKiBub3QgYSBmdW5jdGlvbiBhbmQgaGFzIGEgYHZhbHVlLmxlbmd0aGAgdGhhdCdzIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIG9yXG4gKiBlcXVhbCB0byBgMGAgYW5kIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmXG4gICAgISh0eXBlb2YgdmFsdWUgPT0gJ2Z1bmN0aW9uJyAmJiBpc0Z1bmN0aW9uKHZhbHVlKSkgJiYgaXNMZW5ndGgoZ2V0TGVuZ3RoKHZhbHVlKSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycywgYW5kXG4gIC8vIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgYXJyYXktbGlrZSBsZW5ndGguXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvTGVuZ3RoYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtdG9sZW5ndGgpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzTGVuZ3RoKDMpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNMZW5ndGgoTnVtYmVyLk1JTl9WQUxVRSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoSW5maW5pdHkpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKCczJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0xlbmd0aCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInICYmXG4gICAgdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8PSBNQVhfU0FGRV9JTlRFR0VSO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uYXNzaWduYCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIG93biBhbmRcbiAqIGluaGVyaXRlZCBzb3VyY2UgcHJvcGVydGllcy5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgbXV0YXRlcyBgb2JqZWN0YC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGFsaWFzIGV4dGVuZFxuICogQGNhdGVnb3J5IE9iamVjdFxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VzXSBUaGUgc291cmNlIG9iamVjdHMuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogZnVuY3Rpb24gQmFyKCkge1xuICogICB0aGlzLmQgPSA0O1xuICogfVxuICpcbiAqIEZvby5wcm90b3R5cGUuYyA9IDM7XG4gKiBCYXIucHJvdG90eXBlLmUgPSA1O1xuICpcbiAqIF8uYXNzaWduSW4oeyAnYSc6IDEgfSwgbmV3IEZvbywgbmV3IEJhcik7XG4gKiAvLyA9PiB7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDMsICdkJzogNCwgJ2UnOiA1IH1cbiAqL1xudmFyIGFzc2lnbkluID0gY3JlYXRlQXNzaWduZXIoZnVuY3Rpb24ob2JqZWN0LCBzb3VyY2UpIHtcbiAgY29weU9iamVjdChzb3VyY2UsIGtleXNJbihzb3VyY2UpLCBvYmplY3QpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzaWduSW47XG4iLCIvKipcbiAqIGxvZGFzaCA0LjEuMiAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIE1BWF9TQUZFX0lOVEVHRVIgPSA5MDA3MTk5MjU0NzQwOTkxO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgYXJnc1RhZyA9ICdbb2JqZWN0IEFyZ3VtZW50c10nLFxuICAgIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXScsXG4gICAgc3RyaW5nVGFnID0gJ1tvYmplY3QgU3RyaW5nXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eKD86MHxbMS05XVxcZCopJC87XG5cbi8qKiBVc2VkIHRvIGRldGVybWluZSBpZiB2YWx1ZXMgYXJlIG9mIHRoZSBsYW5ndWFnZSB0eXBlIGBPYmplY3RgLiAqL1xudmFyIG9iamVjdFR5cGVzID0ge1xuICAnZnVuY3Rpb24nOiB0cnVlLFxuICAnb2JqZWN0JzogdHJ1ZVxufTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cbnZhciBmcmVlRXhwb3J0cyA9IChvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cyAmJiAhZXhwb3J0cy5ub2RlVHlwZSlcbiAgPyBleHBvcnRzXG4gIDogdW5kZWZpbmVkO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuICovXG52YXIgZnJlZU1vZHVsZSA9IChvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSlcbiAgPyBtb2R1bGVcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXG52YXIgZnJlZUdsb2JhbCA9IGNoZWNrR2xvYmFsKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xudmFyIGZyZWVTZWxmID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHNlbGZdICYmIHNlbGYpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHdpbmRvd2AuICovXG52YXIgZnJlZVdpbmRvdyA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdyk7XG5cbi8qKiBEZXRlY3QgYHRoaXNgIGFzIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xudmFyIHRoaXNHbG9iYWwgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2YgdGhpc10gJiYgdGhpcyk7XG5cbi8qKlxuICogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cbiAqXG4gKiBUaGUgYHRoaXNgIHZhbHVlIGlzIHVzZWQgaWYgaXQncyB0aGUgZ2xvYmFsIG9iamVjdCB0byBhdm9pZCBHcmVhc2Vtb25rZXknc1xuICogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXG4gKi9cbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxuICAoKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcbiAgICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8udGltZXNgIHdpdGhvdXQgc3VwcG9ydCBmb3IgaXRlcmF0ZWUgc2hvcnRoYW5kc1xuICogb3IgbWF4IGFycmF5IGxlbmd0aCBjaGVja3MuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7bnVtYmVyfSBuIFRoZSBudW1iZXIgb2YgdGltZXMgdG8gaW52b2tlIGBpdGVyYXRlZWAuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBpdGVyYXRlZSBUaGUgZnVuY3Rpb24gaW52b2tlZCBwZXIgaXRlcmF0aW9uLlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiByZXN1bHRzLlxuICovXG5mdW5jdGlvbiBiYXNlVGltZXMobiwgaXRlcmF0ZWUpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICByZXN1bHQgPSBBcnJheShuKTtcblxuICB3aGlsZSAoKytpbmRleCA8IG4pIHtcbiAgICByZXN1bHRbaW5kZXhdID0gaXRlcmF0ZWUoaW5kZXgpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtudWxsfE9iamVjdH0gUmV0dXJucyBgdmFsdWVgIGlmIGl0J3MgYSBnbG9iYWwgb2JqZWN0LCBlbHNlIGBudWxsYC5cbiAqL1xuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSAmJiB2YWx1ZS5PYmplY3QgPT09IE9iamVjdCkgPyB2YWx1ZSA6IG51bGw7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgaXRlcmF0b3JgIHRvIGFuIGFycmF5LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gaXRlcmF0b3IgVGhlIGl0ZXJhdG9yIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBhcnJheS5cbiAqL1xuZnVuY3Rpb24gaXRlcmF0b3JUb0FycmF5KGl0ZXJhdG9yKSB7XG4gIHZhciBkYXRhLFxuICAgICAgcmVzdWx0ID0gW107XG5cbiAgd2hpbGUgKCEoZGF0YSA9IGl0ZXJhdG9yLm5leHQoKSkuZG9uZSkge1xuICAgIHJlc3VsdC5wdXNoKGRhdGEudmFsdWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKiBVc2VkIHRvIGNoZWNrIG9iamVjdHMgZm9yIG93biBwcm9wZXJ0aWVzLiAqL1xudmFyIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIFJlZmxlY3QgPSByb290LlJlZmxlY3QsXG4gICAgZW51bWVyYXRlID0gUmVmbGVjdCA/IFJlZmxlY3QuZW51bWVyYXRlIDogdW5kZWZpbmVkLFxuICAgIHByb3BlcnR5SXNFbnVtZXJhYmxlID0gb2JqZWN0UHJvdG8ucHJvcGVydHlJc0VudW1lcmFibGU7XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ua2V5c0luYCB3aGljaCBkb2Vzbid0IHNraXAgdGhlIGNvbnN0cnVjdG9yXG4gKiBwcm9wZXJ0eSBvZiBwcm90b3R5cGVzIG9yIHRyZWF0IHNwYXJzZSBhcnJheXMgYXMgZGVuc2UuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKi9cbmZ1bmN0aW9uIGJhc2VLZXlzSW4ob2JqZWN0KSB7XG4gIG9iamVjdCA9IG9iamVjdCA9PSBudWxsID8gb2JqZWN0IDogT2JqZWN0KG9iamVjdCk7XG5cbiAgdmFyIHJlc3VsdCA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBGYWxsYmFjayBmb3IgSUUgPCA5IHdpdGggZXM2LXNoaW0uXG5pZiAoZW51bWVyYXRlICYmICFwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHsgJ3ZhbHVlT2YnOiAxIH0sICd2YWx1ZU9mJykpIHtcbiAgYmFzZUtleXNJbiA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBpdGVyYXRvclRvQXJyYXkoZW51bWVyYXRlKG9iamVjdCkpO1xuICB9O1xufVxuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIEdldHMgdGhlIFwibGVuZ3RoXCIgcHJvcGVydHkgdmFsdWUgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCB0byBhdm9pZCBhIFtKSVQgYnVnXShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQyNzkyKVxuICogdGhhdCBhZmZlY3RzIFNhZmFyaSBvbiBhdCBsZWFzdCBpT1MgOC4xLTguMyBBUk02NC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIFwibGVuZ3RoXCIgdmFsdWUuXG4gKi9cbnZhciBnZXRMZW5ndGggPSBiYXNlUHJvcGVydHkoJ2xlbmd0aCcpO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgaW5kZXgga2V5cyBmb3IgYG9iamVjdGAgdmFsdWVzIG9mIGFycmF5cyxcbiAqIGBhcmd1bWVudHNgIG9iamVjdHMsIGFuZCBzdHJpbmdzLCBvdGhlcndpc2UgYG51bGxgIGlzIHJldHVybmVkLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl8bnVsbH0gUmV0dXJucyBpbmRleCBrZXlzLCBlbHNlIGBudWxsYC5cbiAqL1xuZnVuY3Rpb24gaW5kZXhLZXlzKG9iamVjdCkge1xuICB2YXIgbGVuZ3RoID0gb2JqZWN0ID8gb2JqZWN0Lmxlbmd0aCA6IHVuZGVmaW5lZDtcbiAgaWYgKGlzTGVuZ3RoKGxlbmd0aCkgJiZcbiAgICAgIChpc0FycmF5KG9iamVjdCkgfHwgaXNTdHJpbmcob2JqZWN0KSB8fCBpc0FyZ3VtZW50cyhvYmplY3QpKSkge1xuICAgIHJldHVybiBiYXNlVGltZXMobGVuZ3RoLCBTdHJpbmcpO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGxpa2VseSBhIHByb3RvdHlwZSBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwcm90b3R5cGUsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNQcm90b3R5cGUodmFsdWUpIHtcbiAgdmFyIEN0b3IgPSB2YWx1ZSAmJiB2YWx1ZS5jb25zdHJ1Y3RvcixcbiAgICAgIHByb3RvID0gKGlzRnVuY3Rpb24oQ3RvcikgJiYgQ3Rvci5wcm90b3R5cGUpIHx8IG9iamVjdFByb3RvO1xuXG4gIHJldHVybiB2YWx1ZSA9PT0gcHJvdG87XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgbGlrZWx5IGFuIGBhcmd1bWVudHNgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FyZ3VtZW50cyh2YWx1ZSkge1xuICAvLyBTYWZhcmkgOC4xIGluY29ycmVjdGx5IG1ha2VzIGBhcmd1bWVudHMuY2FsbGVlYCBlbnVtZXJhYmxlIGluIHN0cmljdCBtb2RlLlxuICByZXR1cm4gaXNBcnJheUxpa2VPYmplY3QodmFsdWUpICYmIGhhc093blByb3BlcnR5LmNhbGwodmFsdWUsICdjYWxsZWUnKSAmJlxuICAgICghcHJvcGVydHlJc0VudW1lcmFibGUuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpIHx8IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpID09IGFyZ3NUYWcpO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYW4gYEFycmF5YCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEB0eXBlIHtGdW5jdGlvbn1cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheShkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5KCdhYmMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5KF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS4gQSB2YWx1ZSBpcyBjb25zaWRlcmVkIGFycmF5LWxpa2UgaWYgaXQnc1xuICogbm90IGEgZnVuY3Rpb24gYW5kIGhhcyBhIGB2YWx1ZS5sZW5ndGhgIHRoYXQncyBhbiBpbnRlZ2VyIGdyZWF0ZXIgdGhhbiBvclxuICogZXF1YWwgdG8gYDBgIGFuZCBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZShkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKCdhYmMnKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJlxuICAgICEodHlwZW9mIHZhbHVlID09ICdmdW5jdGlvbicgJiYgaXNGdW5jdGlvbih2YWx1ZSkpICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpO1xufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uaXNBcnJheUxpa2VgIGV4Y2VwdCB0aGF0IGl0IGFsc28gY2hlY2tzIGlmIGB2YWx1ZWBcbiAqIGlzIGFuIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gYXJyYXktbGlrZSBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5TGlrZU9iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZU9iamVjdCgnYWJjJyk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiBpc09iamVjdExpa2UodmFsdWUpICYmIGlzQXJyYXlMaWtlKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gU2FmYXJpIDggd2hpY2ggcmV0dXJucyAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLCBhbmRcbiAgLy8gUGhhbnRvbUpTIDEuOSB3aGljaCByZXR1cm5zICdmdW5jdGlvbicgZm9yIGBOb2RlTGlzdGAgaW5zdGFuY2VzLlxuICB2YXIgdGFnID0gaXNPYmplY3QodmFsdWUpID8gb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgcmV0dXJuIHRhZyA9PSBmdW5jVGFnIHx8IHRhZyA9PSBnZW5UYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGxlbmd0aC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBsb29zZWx5IGJhc2VkIG9uIFtgVG9MZW5ndGhgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2xlbmd0aCkuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgbGVuZ3RoLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNMZW5ndGgoMyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0xlbmd0aChOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aChJbmZpbml0eSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNMZW5ndGgoJzMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzTGVuZ3RoKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ251bWJlcicgJiZcbiAgICB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDw9IE1BWF9TQUZFX0lOVEVHRVI7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYFN0cmluZ2AgcHJpbWl0aXZlIG9yIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc1N0cmluZygnYWJjJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc1N0cmluZygxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycgfHxcbiAgICAoIWlzQXJyYXkodmFsdWUpICYmIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gc3RyaW5nVGFnKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHRoZSBvd24gYW5kIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnR5IG5hbWVzIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBOb24tb2JqZWN0IHZhbHVlcyBhcmUgY29lcmNlZCB0byBvYmplY3RzLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQGV4YW1wbGVcbiAqXG4gKiBmdW5jdGlvbiBGb28oKSB7XG4gKiAgIHRoaXMuYSA9IDE7XG4gKiAgIHRoaXMuYiA9IDI7XG4gKiB9XG4gKlxuICogRm9vLnByb3RvdHlwZS5jID0gMztcbiAqXG4gKiBfLmtleXNJbihuZXcgRm9vKTtcbiAqIC8vID0+IFsnYScsICdiJywgJ2MnXSAoaXRlcmF0aW9uIG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkKVxuICovXG5mdW5jdGlvbiBrZXlzSW4ob2JqZWN0KSB7XG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgaXNQcm90byA9IGlzUHJvdG90eXBlKG9iamVjdCksXG4gICAgICBwcm9wcyA9IGJhc2VLZXlzSW4ob2JqZWN0KSxcbiAgICAgIHByb3BzTGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxuICAgICAgaW5kZXhlcyA9IGluZGV4S2V5cyhvYmplY3QpLFxuICAgICAgc2tpcEluZGV4ZXMgPSAhIWluZGV4ZXMsXG4gICAgICByZXN1bHQgPSBpbmRleGVzIHx8IFtdLFxuICAgICAgbGVuZ3RoID0gcmVzdWx0Lmxlbmd0aDtcblxuICB3aGlsZSAoKytpbmRleCA8IHByb3BzTGVuZ3RoKSB7XG4gICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcbiAgICBpZiAoIShza2lwSW5kZXhlcyAmJiAoa2V5ID09ICdsZW5ndGgnIHx8IGlzSW5kZXgoa2V5LCBsZW5ndGgpKSkgJiZcbiAgICAgICAgIShrZXkgPT0gJ2NvbnN0cnVjdG9yJyAmJiAoaXNQcm90byB8fCAhaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkpKSkge1xuICAgICAgcmVzdWx0LnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBrZXlzSW47XG4iLCIvKipcbiAqIGxvZGFzaCA0LjAuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHRoZSBgVHlwZUVycm9yYCBtZXNzYWdlIGZvciBcIkZ1bmN0aW9uc1wiIG1ldGhvZHMuICovXG52YXIgRlVOQ19FUlJPUl9URVhUID0gJ0V4cGVjdGVkIGEgZnVuY3Rpb24nO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBJTkZJTklUWSA9IDEgLyAwLFxuICAgIE1BWF9JTlRFR0VSID0gMS43OTc2OTMxMzQ4NjIzMTU3ZSszMDgsXG4gICAgTkFOID0gMCAvIDA7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCB0byBtYXRjaCBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZXNwYWNlLiAqL1xudmFyIHJlVHJpbSA9IC9eXFxzK3xcXHMrJC9nO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmFkIHNpZ25lZCBoZXhhZGVjaW1hbCBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNCYWRIZXggPSAvXlstK10weFswLTlhLWZdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IGJpbmFyeSBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNCaW5hcnkgPSAvXjBiWzAxXSskL2k7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBvY3RhbCBzdHJpbmcgdmFsdWVzLiAqL1xudmFyIHJlSXNPY3RhbCA9IC9eMG9bMC03XSskL2k7XG5cbi8qKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyB3aXRob3V0IGEgZGVwZW5kZW5jeSBvbiBgcm9vdGAuICovXG52YXIgZnJlZVBhcnNlSW50ID0gcGFyc2VJbnQ7XG5cbi8qKlxuICogQSBmYXN0ZXIgYWx0ZXJuYXRpdmUgdG8gYEZ1bmN0aW9uI2FwcGx5YCwgdGhpcyBmdW5jdGlvbiBpbnZva2VzIGBmdW5jYFxuICogd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgYHRoaXNBcmdgIGFuZCB0aGUgYXJndW1lbnRzIG9mIGBhcmdzYC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gaW52b2tlLlxuICogQHBhcmFtIHsqfSB0aGlzQXJnIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXG4gKiBAcGFyYW0gey4uLip9IGFyZ3MgVGhlIGFyZ3VtZW50cyB0byBpbnZva2UgYGZ1bmNgIHdpdGguXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgcmVzdWx0IG9mIGBmdW5jYC5cbiAqL1xuZnVuY3Rpb24gYXBwbHkoZnVuYywgdGhpc0FyZywgYXJncykge1xuICB2YXIgbGVuZ3RoID0gYXJncy5sZW5ndGg7XG4gIHN3aXRjaCAobGVuZ3RoKSB7XG4gICAgY2FzZSAwOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcpO1xuICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhcmdzWzBdKTtcbiAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYXJnc1swXSwgYXJnc1sxXSk7XG4gICAgY2FzZSAzOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFyZ3NbMF0sIGFyZ3NbMV0sIGFyZ3NbMl0pO1xuICB9XG4gIHJldHVybiBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xufVxuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKiBCdWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcyBmb3IgdGhvc2Ugd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMuICovXG52YXIgbmF0aXZlTWF4ID0gTWF0aC5tYXg7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaW52b2tlcyBgZnVuY2Agd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlXG4gKiBjcmVhdGVkIGZ1bmN0aW9uIGFuZCBhcmd1bWVudHMgZnJvbSBgc3RhcnRgIGFuZCBiZXlvbmQgcHJvdmlkZWQgYXMgYW4gYXJyYXkuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIGlzIGJhc2VkIG9uIHRoZSBbcmVzdCBwYXJhbWV0ZXJdKGh0dHBzOi8vbWRuLmlvL3Jlc3RfcGFyYW1ldGVycykuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBGdW5jdGlvblxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gYXBwbHkgYSByZXN0IHBhcmFtZXRlciB0by5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbc3RhcnQ9ZnVuYy5sZW5ndGgtMV0gVGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoZSByZXN0IHBhcmFtZXRlci5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgc2F5ID0gXy5yZXN0KGZ1bmN0aW9uKHdoYXQsIG5hbWVzKSB7XG4gKiAgIHJldHVybiB3aGF0ICsgJyAnICsgXy5pbml0aWFsKG5hbWVzKS5qb2luKCcsICcpICtcbiAqICAgICAoXy5zaXplKG5hbWVzKSA+IDEgPyAnLCAmICcgOiAnJykgKyBfLmxhc3QobmFtZXMpO1xuICogfSk7XG4gKlxuICogc2F5KCdoZWxsbycsICdmcmVkJywgJ2Jhcm5leScsICdwZWJibGVzJyk7XG4gKiAvLyA9PiAnaGVsbG8gZnJlZCwgYmFybmV5LCAmIHBlYmJsZXMnXG4gKi9cbmZ1bmN0aW9uIHJlc3QoZnVuYywgc3RhcnQpIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEZVTkNfRVJST1JfVEVYVCk7XG4gIH1cbiAgc3RhcnQgPSBuYXRpdmVNYXgoc3RhcnQgPT09IHVuZGVmaW5lZCA/IChmdW5jLmxlbmd0aCAtIDEpIDogdG9JbnRlZ2VyKHN0YXJ0KSwgMCk7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcbiAgICAgICAgaW5kZXggPSAtMSxcbiAgICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KGFyZ3MubGVuZ3RoIC0gc3RhcnQsIDApLFxuICAgICAgICBhcnJheSA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgYXJyYXlbaW5kZXhdID0gYXJnc1tzdGFydCArIGluZGV4XTtcbiAgICB9XG4gICAgc3dpdGNoIChzdGFydCkge1xuICAgICAgY2FzZSAwOiByZXR1cm4gZnVuYy5jYWxsKHRoaXMsIGFycmF5KTtcbiAgICAgIGNhc2UgMTogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmdzWzBdLCBhcnJheSk7XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJnc1swXSwgYXJnc1sxXSwgYXJyYXkpO1xuICAgIH1cbiAgICB2YXIgb3RoZXJBcmdzID0gQXJyYXkoc3RhcnQgKyAxKTtcbiAgICBpbmRleCA9IC0xO1xuICAgIHdoaWxlICgrK2luZGV4IDwgc3RhcnQpIHtcbiAgICAgIG90aGVyQXJnc1tpbmRleF0gPSBhcmdzW2luZGV4XTtcbiAgICB9XG4gICAgb3RoZXJBcmdzW3N0YXJ0XSA9IGFycmF5O1xuICAgIHJldHVybiBhcHBseShmdW5jLCB0aGlzLCBvdGhlckFyZ3MpO1xuICB9O1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMsIGFuZFxuICAvLyBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGFuIGludGVnZXIuXG4gKlxuICogKipOb3RlOioqIFRoaXMgZnVuY3Rpb24gaXMgbG9vc2VseSBiYXNlZCBvbiBbYFRvSW50ZWdlcmBdKGh0dHA6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy10b2ludGVnZXIpLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGNvbnZlcnRlZCBpbnRlZ2VyLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLnRvSW50ZWdlcigzKTtcbiAqIC8vID0+IDNcbiAqXG4gKiBfLnRvSW50ZWdlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDBcbiAqXG4gKiBfLnRvSW50ZWdlcihJbmZpbml0eSk7XG4gKiAvLyA9PiAxLjc5NzY5MzEzNDg2MjMxNTdlKzMwOFxuICpcbiAqIF8udG9JbnRlZ2VyKCczJyk7XG4gKiAvLyA9PiAzXG4gKi9cbmZ1bmN0aW9uIHRvSW50ZWdlcih2YWx1ZSkge1xuICBpZiAoIXZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiAwO1xuICB9XG4gIHZhbHVlID0gdG9OdW1iZXIodmFsdWUpO1xuICBpZiAodmFsdWUgPT09IElORklOSVRZIHx8IHZhbHVlID09PSAtSU5GSU5JVFkpIHtcbiAgICB2YXIgc2lnbiA9ICh2YWx1ZSA8IDAgPyAtMSA6IDEpO1xuICAgIHJldHVybiBzaWduICogTUFYX0lOVEVHRVI7XG4gIH1cbiAgdmFyIHJlbWFpbmRlciA9IHZhbHVlICUgMTtcbiAgcmV0dXJuIHZhbHVlID09PSB2YWx1ZSA/IChyZW1haW5kZXIgPyB2YWx1ZSAtIHJlbWFpbmRlciA6IHZhbHVlKSA6IDA7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIG51bWJlci5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBudW1iZXIuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udG9OdW1iZXIoMyk7XG4gKiAvLyA9PiAzXG4gKlxuICogXy50b051bWJlcihOdW1iZXIuTUlOX1ZBTFVFKTtcbiAqIC8vID0+IDVlLTMyNFxuICpcbiAqIF8udG9OdW1iZXIoSW5maW5pdHkpO1xuICogLy8gPT4gSW5maW5pdHlcbiAqXG4gKiBfLnRvTnVtYmVyKCczJyk7XG4gKiAvLyA9PiAzXG4gKi9cbmZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlKSB7XG4gIGlmIChpc09iamVjdCh2YWx1ZSkpIHtcbiAgICB2YXIgb3RoZXIgPSBpc0Z1bmN0aW9uKHZhbHVlLnZhbHVlT2YpID8gdmFsdWUudmFsdWVPZigpIDogdmFsdWU7XG4gICAgdmFsdWUgPSBpc09iamVjdChvdGhlcikgPyAob3RoZXIgKyAnJykgOiBvdGhlcjtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlICE9ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAwID8gdmFsdWUgOiArdmFsdWU7XG4gIH1cbiAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKHJlVHJpbSwgJycpO1xuICB2YXIgaXNCaW5hcnkgPSByZUlzQmluYXJ5LnRlc3QodmFsdWUpO1xuICByZXR1cm4gKGlzQmluYXJ5IHx8IHJlSXNPY3RhbC50ZXN0KHZhbHVlKSlcbiAgICA/IGZyZWVQYXJzZUludCh2YWx1ZS5zbGljZSgyKSwgaXNCaW5hcnkgPyAyIDogOClcbiAgICA6IChyZUlzQmFkSGV4LnRlc3QodmFsdWUpID8gTkFOIDogK3ZhbHVlKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZXN0O1xuIiwiLyoqXG4gKiBsb2Rhc2ggMy4wLjggKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgZ2VuVGFnID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJztcblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYEZ1bmN0aW9uYCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNGdW5jdGlvbihfKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oL2FiYy8pO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xuICAvLyBUaGUgdXNlIG9mIGBPYmplY3QjdG9TdHJpbmdgIGF2b2lkcyBpc3N1ZXMgd2l0aCB0aGUgYHR5cGVvZmAgb3BlcmF0b3JcbiAgLy8gaW4gU2FmYXJpIDggd2hpY2ggcmV0dXJucyAnb2JqZWN0JyBmb3IgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzLCBhbmRcbiAgLy8gUGhhbnRvbUpTIDEuOSB3aGljaCByZXR1cm5zICdmdW5jdGlvbicgZm9yIGBOb2RlTGlzdGAgaW5zdGFuY2VzLlxuICB2YXIgdGFnID0gaXNPYmplY3QodmFsdWUpID8gb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgcmV0dXJuIHRhZyA9PSBmdW5jVGFnIHx8IHRhZyA9PSBnZW5UYWc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgdGhlIFtsYW5ndWFnZSB0eXBlXShodHRwczovL2VzNS5naXRodWIuaW8vI3g4KSBvZiBgT2JqZWN0YC5cbiAqIChlLmcuIGFycmF5cywgZnVuY3Rpb25zLCBvYmplY3RzLCByZWdleGVzLCBgbmV3IE51bWJlcigwKWAsIGFuZCBgbmV3IFN0cmluZygnJylgKVxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdCh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoXy5ub29wKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIHJldHVybiAhIXZhbHVlICYmICh0eXBlID09ICdvYmplY3QnIHx8IHR5cGUgPT0gJ2Z1bmN0aW9uJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvbjtcbiIsIi8qKlxuICogbG9kYXNoIDQuMC4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIHN0cmluZ1RhZyA9ICdbb2JqZWN0IFN0cmluZ10nO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYW4gYEFycmF5YCBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEB0eXBlIEZ1bmN0aW9uXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXkoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXkoZG9jdW1lbnQuYm9keS5jaGlsZHJlbik7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNBcnJheSgnYWJjJyk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNBcnJheShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqL1xudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLiBBIHZhbHVlIGlzIG9iamVjdC1saWtlIGlmIGl0J3Mgbm90IGBudWxsYFxuICogYW5kIGhhcyBhIGB0eXBlb2ZgIHJlc3VsdCBvZiBcIm9iamVjdFwiLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZSh7fSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShfLm5vb3ApO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBTdHJpbmdgIHByaW1pdGl2ZSBvciBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNTdHJpbmcoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNTdHJpbmcoMSk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdzdHJpbmcnIHx8XG4gICAgKCFpc0FycmF5KHZhbHVlKSAmJiBpc09iamVjdExpa2UodmFsdWUpICYmIG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpID09IHN0cmluZ1RhZyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNTdHJpbmc7XG4iLCIvKipcbiAqIGxvZGFzaCA0LjAuMCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIgdG9TdHJpbmcgPSByZXF1aXJlKCdsb2Rhc2gudG9zdHJpbmcnKTtcblxuLyoqIFVzZWQgdG8gZ2VuZXJhdGUgdW5pcXVlIElEcy4gKi9cbnZhciBpZENvdW50ZXIgPSAwO1xuXG4vKipcbiAqIEdlbmVyYXRlcyBhIHVuaXF1ZSBJRC4gSWYgYHByZWZpeGAgaXMgZ2l2ZW4gdGhlIElEIGlzIGFwcGVuZGVkIHRvIGl0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgVXRpbFxuICogQHBhcmFtIHtzdHJpbmd9IFtwcmVmaXhdIFRoZSB2YWx1ZSB0byBwcmVmaXggdGhlIElEIHdpdGguXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSB1bmlxdWUgSUQuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udW5pcXVlSWQoJ2NvbnRhY3RfJyk7XG4gKiAvLyA9PiAnY29udGFjdF8xMDQnXG4gKlxuICogXy51bmlxdWVJZCgpO1xuICogLy8gPT4gJzEwNSdcbiAqL1xuZnVuY3Rpb24gdW5pcXVlSWQocHJlZml4KSB7XG4gIHZhciBpZCA9ICsraWRDb3VudGVyO1xuICByZXR1cm4gdG9TdHJpbmcocHJlZml4KSArIGlkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHVuaXF1ZUlkO1xuIiwiLyoqXG4gKiBsb2Rhc2ggNC4xLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBJTkZJTklUWSA9IDEgLyAwO1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgc3ltYm9sVGFnID0gJ1tvYmplY3QgU3ltYm9sXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVybWluZSBpZiB2YWx1ZXMgYXJlIG9mIHRoZSBsYW5ndWFnZSB0eXBlIGBPYmplY3RgLiAqL1xudmFyIG9iamVjdFR5cGVzID0ge1xuICAnZnVuY3Rpb24nOiB0cnVlLFxuICAnb2JqZWN0JzogdHJ1ZVxufTtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYC4gKi9cbnZhciBmcmVlRXhwb3J0cyA9IChvYmplY3RUeXBlc1t0eXBlb2YgZXhwb3J0c10gJiYgZXhwb3J0cyAmJiAhZXhwb3J0cy5ub2RlVHlwZSlcbiAgPyBleHBvcnRzXG4gIDogdW5kZWZpbmVkO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuICovXG52YXIgZnJlZU1vZHVsZSA9IChvYmplY3RUeXBlc1t0eXBlb2YgbW9kdWxlXSAmJiBtb2R1bGUgJiYgIW1vZHVsZS5ub2RlVHlwZSlcbiAgPyBtb2R1bGVcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMuICovXG52YXIgZnJlZUdsb2JhbCA9IGNoZWNrR2xvYmFsKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUgJiYgdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWwpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHNlbGZgLiAqL1xudmFyIGZyZWVTZWxmID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHNlbGZdICYmIHNlbGYpO1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYHdpbmRvd2AuICovXG52YXIgZnJlZVdpbmRvdyA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdyk7XG5cbi8qKiBEZXRlY3QgYHRoaXNgIGFzIHRoZSBnbG9iYWwgb2JqZWN0LiAqL1xudmFyIHRoaXNHbG9iYWwgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2YgdGhpc10gJiYgdGhpcyk7XG5cbi8qKlxuICogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdC5cbiAqXG4gKiBUaGUgYHRoaXNgIHZhbHVlIGlzIHVzZWQgaWYgaXQncyB0aGUgZ2xvYmFsIG9iamVjdCB0byBhdm9pZCBHcmVhc2Vtb25rZXknc1xuICogcmVzdHJpY3RlZCBgd2luZG93YCBvYmplY3QsIG90aGVyd2lzZSB0aGUgYHdpbmRvd2Agb2JqZWN0IGlzIHVzZWQuXG4gKi9cbnZhciByb290ID0gZnJlZUdsb2JhbCB8fFxuICAoKGZyZWVXaW5kb3cgIT09ICh0aGlzR2xvYmFsICYmIHRoaXNHbG9iYWwud2luZG93KSkgJiYgZnJlZVdpbmRvdykgfHxcbiAgICBmcmVlU2VsZiB8fCB0aGlzR2xvYmFsIHx8IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtudWxsfE9iamVjdH0gUmV0dXJucyBgdmFsdWVgIGlmIGl0J3MgYSBnbG9iYWwgb2JqZWN0LCBlbHNlIGBudWxsYC5cbiAqL1xuZnVuY3Rpb24gY2hlY2tHbG9iYWwodmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSAmJiB2YWx1ZS5PYmplY3QgPT09IE9iamVjdCkgPyB2YWx1ZSA6IG51bGw7XG59XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKiBCdWlsdC1pbiB2YWx1ZSByZWZlcmVuY2VzLiAqL1xudmFyIFN5bWJvbCA9IHJvb3QuU3ltYm9sO1xuXG4vKiogVXNlZCB0byBjb252ZXJ0IHN5bWJvbHMgdG8gcHJpbWl0aXZlcyBhbmQgc3RyaW5ncy4gKi9cbnZhciBzeW1ib2xQcm90byA9IFN5bWJvbCA/IFN5bWJvbC5wcm90b3R5cGUgOiB1bmRlZmluZWQsXG4gICAgc3ltYm9sVG9TdHJpbmcgPSBTeW1ib2wgPyBzeW1ib2xQcm90by50b1N0cmluZyA6IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS4gQSB2YWx1ZSBpcyBvYmplY3QtbGlrZSBpZiBpdCdzIG5vdCBgbnVsbGBcbiAqIGFuZCBoYXMgYSBgdHlwZW9mYCByZXN1bHQgb2YgXCJvYmplY3RcIi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgU3ltYm9sYCBwcmltaXRpdmUgb3Igb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzU3ltYm9sKFN5bWJvbC5pdGVyYXRvcik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc1N5bWJvbCgnYWJjJyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N5bWJvbCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdzeW1ib2wnIHx8XG4gICAgKGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gc3ltYm9sVGFnKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGEgc3RyaW5nIGlmIGl0J3Mgbm90IG9uZS4gQW4gZW1wdHkgc3RyaW5nIGlzIHJldHVybmVkXG4gKiBmb3IgYG51bGxgIGFuZCBgdW5kZWZpbmVkYCB2YWx1ZXMuIFRoZSBzaWduIG9mIGAtMGAgaXMgcHJlc2VydmVkLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHN0cmluZy5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50b1N0cmluZyhudWxsKTtcbiAqIC8vID0+ICcnXG4gKlxuICogXy50b1N0cmluZygtMCk7XG4gKiAvLyA9PiAnLTAnXG4gKlxuICogXy50b1N0cmluZyhbMSwgMiwgM10pO1xuICogLy8gPT4gJzEsMiwzJ1xuICovXG5mdW5jdGlvbiB0b1N0cmluZyh2YWx1ZSkge1xuICAvLyBFeGl0IGVhcmx5IGZvciBzdHJpbmdzIHRvIGF2b2lkIGEgcGVyZm9ybWFuY2UgaGl0IGluIHNvbWUgZW52aXJvbm1lbnRzLlxuICBpZiAodHlwZW9mIHZhbHVlID09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIGlmIChpc1N5bWJvbCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gU3ltYm9sID8gc3ltYm9sVG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgfVxuICB2YXIgcmVzdWx0ID0gKHZhbHVlICsgJycpO1xuICByZXR1cm4gKHJlc3VsdCA9PSAnMCcgJiYgKDEgLyB2YWx1ZSkgPT0gLUlORklOSVRZKSA/ICctMCcgOiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9TdHJpbmc7XG4iLCIvKiBqc2hpbnQgYnJvd3NlcjogdHJ1ZSAqL1xuXG4oZnVuY3Rpb24gKCkge1xuXG4vLyBUaGUgcHJvcGVydGllcyB0aGF0IHdlIGNvcHkgaW50byBhIG1pcnJvcmVkIGRpdi5cbi8vIE5vdGUgdGhhdCBzb21lIGJyb3dzZXJzLCBzdWNoIGFzIEZpcmVmb3gsXG4vLyBkbyBub3QgY29uY2F0ZW5hdGUgcHJvcGVydGllcywgaS5lLiBwYWRkaW5nLXRvcCwgYm90dG9tIGV0Yy4gLT4gcGFkZGluZyxcbi8vIHNvIHdlIGhhdmUgdG8gZG8gZXZlcnkgc2luZ2xlIHByb3BlcnR5IHNwZWNpZmljYWxseS5cbnZhciBwcm9wZXJ0aWVzID0gW1xuICAnZGlyZWN0aW9uJywgIC8vIFJUTCBzdXBwb3J0XG4gICdib3hTaXppbmcnLFxuICAnd2lkdGgnLCAgLy8gb24gQ2hyb21lIGFuZCBJRSwgZXhjbHVkZSB0aGUgc2Nyb2xsYmFyLCBzbyB0aGUgbWlycm9yIGRpdiB3cmFwcyBleGFjdGx5IGFzIHRoZSB0ZXh0YXJlYSBkb2VzXG4gICdoZWlnaHQnLFxuICAnb3ZlcmZsb3dYJyxcbiAgJ292ZXJmbG93WScsICAvLyBjb3B5IHRoZSBzY3JvbGxiYXIgZm9yIElFXG5cbiAgJ2JvcmRlclRvcFdpZHRoJyxcbiAgJ2JvcmRlclJpZ2h0V2lkdGgnLFxuICAnYm9yZGVyQm90dG9tV2lkdGgnLFxuICAnYm9yZGVyTGVmdFdpZHRoJyxcbiAgJ2JvcmRlclN0eWxlJyxcblxuICAncGFkZGluZ1RvcCcsXG4gICdwYWRkaW5nUmlnaHQnLFxuICAncGFkZGluZ0JvdHRvbScsXG4gICdwYWRkaW5nTGVmdCcsXG5cbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL2ZvbnRcbiAgJ2ZvbnRTdHlsZScsXG4gICdmb250VmFyaWFudCcsXG4gICdmb250V2VpZ2h0JyxcbiAgJ2ZvbnRTdHJldGNoJyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRTaXplQWRqdXN0JyxcbiAgJ2xpbmVIZWlnaHQnLFxuICAnZm9udEZhbWlseScsXG5cbiAgJ3RleHRBbGlnbicsXG4gICd0ZXh0VHJhbnNmb3JtJyxcbiAgJ3RleHRJbmRlbnQnLFxuICAndGV4dERlY29yYXRpb24nLCAgLy8gbWlnaHQgbm90IG1ha2UgYSBkaWZmZXJlbmNlLCBidXQgYmV0dGVyIGJlIHNhZmVcblxuICAnbGV0dGVyU3BhY2luZycsXG4gICd3b3JkU3BhY2luZycsXG5cbiAgJ3RhYlNpemUnLFxuICAnTW96VGFiU2l6ZSdcblxuXTtcblxudmFyIGlzQnJvd3NlciA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyk7XG52YXIgaXNGaXJlZm94ID0gKGlzQnJvd3NlciAmJiB3aW5kb3cubW96SW5uZXJTY3JlZW5YICE9IG51bGwpO1xuXG5mdW5jdGlvbiBnZXRDYXJldENvb3JkaW5hdGVzKGVsZW1lbnQsIHBvc2l0aW9uLCBvcHRpb25zKSB7XG4gIGlmKCFpc0Jyb3dzZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RleHRhcmVhLWNhcmV0LXBvc2l0aW9uI2dldENhcmV0Q29vcmRpbmF0ZXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGluIGEgYnJvd3NlcicpO1xuICB9XG5cbiAgdmFyIGRlYnVnID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlYnVnIHx8IGZhbHNlO1xuICBpZiAoZGVidWcpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjaW5wdXQtdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24tbWlycm9yLWRpdicpO1xuICAgIGlmICggZWwgKSB7IGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpOyB9XG4gIH1cblxuICAvLyBtaXJyb3JlZCBkaXZcbiAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBkaXYuaWQgPSAnaW5wdXQtdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24tbWlycm9yLWRpdic7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcblxuICB2YXIgc3R5bGUgPSBkaXYuc3R5bGU7XG4gIHZhciBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlPyBnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpIDogZWxlbWVudC5jdXJyZW50U3R5bGU7ICAvLyBjdXJyZW50U3R5bGUgZm9yIElFIDwgOVxuXG4gIC8vIGRlZmF1bHQgdGV4dGFyZWEgc3R5bGVzXG4gIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuICBpZiAoZWxlbWVudC5ub2RlTmFtZSAhPT0gJ0lOUFVUJylcbiAgICBzdHlsZS53b3JkV3JhcCA9ICdicmVhay13b3JkJzsgIC8vIG9ubHkgZm9yIHRleHRhcmVhLXNcblxuICAvLyBwb3NpdGlvbiBvZmYtc2NyZWVuXG4gIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJzsgIC8vIHJlcXVpcmVkIHRvIHJldHVybiBjb29yZGluYXRlcyBwcm9wZXJseVxuICBpZiAoIWRlYnVnKVxuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJzsgIC8vIG5vdCAnZGlzcGxheTogbm9uZScgYmVjYXVzZSB3ZSB3YW50IHJlbmRlcmluZ1xuXG4gIC8vIHRyYW5zZmVyIHRoZSBlbGVtZW50J3MgcHJvcGVydGllcyB0byB0aGUgZGl2XG4gIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xuICAgIHN0eWxlW3Byb3BdID0gY29tcHV0ZWRbcHJvcF07XG4gIH0pO1xuXG4gIGlmIChpc0ZpcmVmb3gpIHtcbiAgICAvLyBGaXJlZm94IGxpZXMgYWJvdXQgdGhlIG92ZXJmbG93IHByb3BlcnR5IGZvciB0ZXh0YXJlYXM6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTk4NDI3NVxuICAgIGlmIChlbGVtZW50LnNjcm9sbEhlaWdodCA+IHBhcnNlSW50KGNvbXB1dGVkLmhlaWdodCkpXG4gICAgICBzdHlsZS5vdmVyZmxvd1kgPSAnc2Nyb2xsJztcbiAgfSBlbHNlIHtcbiAgICBzdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nOyAgLy8gZm9yIENocm9tZSB0byBub3QgcmVuZGVyIGEgc2Nyb2xsYmFyOyBJRSBrZWVwcyBvdmVyZmxvd1kgPSAnc2Nyb2xsJ1xuICB9XG5cbiAgZGl2LnRleHRDb250ZW50ID0gZWxlbWVudC52YWx1ZS5zdWJzdHJpbmcoMCwgcG9zaXRpb24pO1xuICAvLyB0aGUgc2Vjb25kIHNwZWNpYWwgaGFuZGxpbmcgZm9yIGlucHV0IHR5cGU9XCJ0ZXh0XCIgdnMgdGV4dGFyZWE6IHNwYWNlcyBuZWVkIHRvIGJlIHJlcGxhY2VkIHdpdGggbm9uLWJyZWFraW5nIHNwYWNlcyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEzNDAyMDM1LzEyNjkwMzdcbiAgaWYgKGVsZW1lbnQubm9kZU5hbWUgPT09ICdJTlBVVCcpXG4gICAgZGl2LnRleHRDb250ZW50ID0gZGl2LnRleHRDb250ZW50LnJlcGxhY2UoL1xccy9nLCAnXFx1MDBhMCcpO1xuXG4gIHZhciBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAvLyBXcmFwcGluZyBtdXN0IGJlIHJlcGxpY2F0ZWQgKmV4YWN0bHkqLCBpbmNsdWRpbmcgd2hlbiBhIGxvbmcgd29yZCBnZXRzXG4gIC8vIG9udG8gdGhlIG5leHQgbGluZSwgd2l0aCB3aGl0ZXNwYWNlIGF0IHRoZSBlbmQgb2YgdGhlIGxpbmUgYmVmb3JlICgjNykuXG4gIC8vIFRoZSAgKm9ubHkqIHJlbGlhYmxlIHdheSB0byBkbyB0aGF0IGlzIHRvIGNvcHkgdGhlICplbnRpcmUqIHJlc3Qgb2YgdGhlXG4gIC8vIHRleHRhcmVhJ3MgY29udGVudCBpbnRvIHRoZSA8c3Bhbj4gY3JlYXRlZCBhdCB0aGUgY2FyZXQgcG9zaXRpb24uXG4gIC8vIGZvciBpbnB1dHMsIGp1c3QgJy4nIHdvdWxkIGJlIGVub3VnaCwgYnV0IHdoeSBib3RoZXI/XG4gIHNwYW4udGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZyhwb3NpdGlvbikgfHwgJy4nOyAgLy8gfHwgYmVjYXVzZSBhIGNvbXBsZXRlbHkgZW1wdHkgZmF1eCBzcGFuIGRvZXNuJ3QgcmVuZGVyIGF0IGFsbFxuICBkaXYuYXBwZW5kQ2hpbGQoc3Bhbik7XG5cbiAgdmFyIGNvb3JkaW5hdGVzID0ge1xuICAgIHRvcDogc3Bhbi5vZmZzZXRUb3AgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyVG9wV2lkdGgnXSksXG4gICAgbGVmdDogc3Bhbi5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKVxuICB9O1xuXG4gIGlmIChkZWJ1Zykge1xuICAgIHNwYW4uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyNhYWEnO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGl2KTtcbiAgfVxuXG4gIHJldHVybiBjb29yZGluYXRlcztcbn1cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcbn0gZWxzZSBpZihpc0Jyb3dzZXIpe1xuICB3aW5kb3cuZ2V0Q2FyZXRDb29yZGluYXRlcyA9IGdldENhcmV0Q29vcmRpbmF0ZXM7XG59XG5cbn0oKSk7XG4iLCJpbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuY29uc3QgQ0FMTEJBQ0tfTUVUSE9EUyA9IFsnaGFuZGxlUXVlcnlSZXN1bHQnXTtcblxuLyoqXG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqL1xuY2xhc3MgQ29tcGxldGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmF0ZWdpZXMgPSBbXTtcblxuICAgIC8vIEJpbmQgY2FsbGJhY2sgbWV0aG9kc1xuICAgIENBTExCQUNLX01FVEhPRFMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdLmJpbmQodGhpcyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzdHJhdGVneSB0byB0aGUgY29tcGxldGVyLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l9IHN0cmF0ZWd5XG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgcmVnaXN0ZXJTdHJhdGVneShzdHJhdGVneSkge1xuICAgIHRoaXMuc3RyYXRlZ2llcy5wdXNoKHN0cmF0ZWd5KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gSGVhZCB0byBpbnB1dCBjdXJzb3IuXG4gICAqIEBmaXJlcyBDb21wbGV0ZXIjaGl0XG4gICAqL1xuICBydW4odGV4dCkge1xuICAgIHZhciBxdWVyeSA9IHRoaXMuZXh0cmFjdFF1ZXJ5KHRleHQpO1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgcXVlcnkuZXhlY3V0ZSh0aGlzLmhhbmRsZVF1ZXJ5UmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oYW5kbGVRdWVyeVJlc3VsdChbXSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgYSBxdWVyeSwgd2hpY2ggbWF0Y2hlcyB0byB0aGUgZ2l2ZW4gdGV4dC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBIZWFkIHRvIGlucHV0IGN1cnNvci5cbiAgICogQHJldHVybnMgez9RdWVyeX1cbiAgICovXG4gIGV4dHJhY3RRdWVyeSh0ZXh0KSB7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMuc3RyYXRlZ2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHF1ZXJ5ID0gdGhpcy5zdHJhdGVnaWVzW2ldLmJ1aWxkUXVlcnkodGV4dCk7XG4gICAgICBpZiAocXVlcnkpIHsgcmV0dXJuIHF1ZXJ5OyB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrZWQgYnkgUXVlcnkjZXhlY3V0ZS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTZWFyY2hSZXN1bHRbXX0gc2VhcmNoUmVzdWx0c1xuICAgKi9cbiAgaGFuZGxlUXVlcnlSZXN1bHQoc2VhcmNoUmVzdWx0cykge1xuICAgIC8qKlxuICAgICAqIEBldmVudCBDb21wbGV0ZXIjaGl0XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcCB7U2VhcmNoUmVzdWx0W119IHNlYXJjaFJlc3VsdHNcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQoJ2hpdCcsIHsgc2VhcmNoUmVzdWx0cyB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDb21wbGV0ZXI7XG4iLCJpbXBvcnQgVGV4dGNvbXBsZXRlIGZyb20gJy4uL3RleHRjb21wbGV0ZSc7XG5cbmltcG9ydCBUZXh0YXJlYSBmcm9tICcuLi90ZXh0YXJlYSc7XG5cbnZhciB0ZXh0YXJlYSA9IG5ldyBUZXh0YXJlYShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGV4dGFyZWExJykpO1xudmFyIHRleHRjb21wbGV0ZSA9IG5ldyBUZXh0Y29tcGxldGUodGV4dGFyZWEpO1xudGV4dGNvbXBsZXRlLnJlZ2lzdGVyKFtcbiAge1xuICAgIG1hdGNoOiAvKF58XFxzKShcXHcrKSQvLFxuICAgIHNlYXJjaDogZnVuY3Rpb24gKHRlcm0sIGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhbdGVybS50b1VwcGVyQ2FzZSgpLCB0ZXJtLnRvTG93ZXJDYXNlKCldKTtcbiAgICB9LFxuICAgIHJlcGxhY2U6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIGAkMSR7dmFsdWV9IGA7XG4gICAgfVxuICB9XG5dKTtcbiIsImltcG9ydCB1bmlxdWVJZCBmcm9tICdsb2Rhc2gudW5pcXVlaWQnO1xuXG5leHBvcnQgY29uc3QgQ0xBU1NfTkFNRSA9ICd0ZXh0Y29tcGxldGUtaXRlbSc7XG5jb25zdCBBQ1RJVkVfQ0xBU1NfTkFNRSA9IGAke0NMQVNTX05BTUV9IGFjdGl2ZWA7XG5jb25zdCBDQUxMQkFDS19NRVRIT0RTID0gWydvbkNsaWNrJ107XG5cbi8qKlxuICogRW5jYXBzdWxhdGUgYW4gaXRlbSBvZiBkcm9wZG93bi5cbiAqL1xuY2xhc3MgRHJvcGRvd25JdGVtIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0fSBzZWFyY2hSZXN1bHRcbiAgICovXG4gIGNvbnN0cnVjdG9yKHNlYXJjaFJlc3VsdCkge1xuICAgIHRoaXMuc2VhcmNoUmVzdWx0ID0gc2VhcmNoUmVzdWx0O1xuICAgIHRoaXMuaWQgPSB1bmlxdWVJZCgnZHJvcGRvd24taXRlbS0nKTtcbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgQ0FMTEJBQ0tfTUVUSE9EUy5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgdGhpc1tuYW1lXSA9IHRoaXNbbmFtZV0uYmluZCh0aGlzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEByZXR1cm5zIHtIVE1MTElFbGVtZW50fVxuICAgKi9cbiAgZ2V0IGVsKCkge1xuICAgIGlmICghdGhpcy5fZWwpIHtcbiAgICAgIGxldCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gICAgICBsaS5pZCA9IHRoaXMuaWQ7XG4gICAgICBsaS5jbGFzc05hbWUgPSB0aGlzLmFjdGl2ZSA/IEFDVElWRV9DTEFTU19OQU1FIDogQ0xBU1NfTkFNRTtcbiAgICAgIGxldCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgYS5pbm5lckhUTUwgPSB0aGlzLnNlYXJjaFJlc3VsdC5yZW5kZXIoKTtcbiAgICAgIGxpLmFwcGVuZENoaWxkKGEpO1xuICAgICAgdGhpcy5fZWwgPSBsaTtcbiAgICAgIGxpLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25DbGljayk7XG4gICAgICBsaS5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5vbkNsaWNrKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2VsO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyeSB0byBmcmVlIHJlc291cmNlcyBhbmQgcGVyZm9ybSBvdGhlciBjbGVhbnVwIG9wZXJhdGlvbnMuXG4gICAqXG4gICAqIEBwdWJsaWNcbiAgICovXG4gIGZpbmFsaXplKCkge1xuICAgIHRoaXMuX2VsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25DbGljaywgZmFsc2UpO1xuICAgIHRoaXMuX2VsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLm9uQ2xpY2ssIGZhbHNlKTtcbiAgICAvLyBUaGlzIGVsZW1lbnQgaGFzIGFscmVhZHkgYmVlbiByZW1vdmVkIGJ5IGBEcm9wZG93biNjbGVhcmAuXG4gICAgdGhpcy5fZWwgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrZWQgd2hlbiBpdCBpcyBhcHBlbmRlZCB0byBhIGRyb3Bkb3duLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7RHJvcGRvd259IGRyb3Bkb3duXG4gICAqIEBzZWUgRHJvcGRvd24jYXBwZW5kXG4gICAqL1xuICBhcHBlbmRlZChkcm9wZG93bikge1xuICAgIHRoaXMuZHJvcGRvd24gPSBkcm9wZG93bjtcbiAgICB0aGlzLnNpYmxpbmdzID0gZHJvcGRvd24uaXRlbXM7XG4gICAgdGhpcy5pbmRleCA9IHRoaXMuc2libGluZ3MubGVuZ3RoIC0gMTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gMCkge1xuICAgICAgdGhpcy5hY3RpdmF0ZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgYWN0aXZhdGUoKSB7XG4gICAgaWYgKCF0aGlzLmFjdGl2ZSkge1xuICAgICAgdGhpcy5hY3RpdmUgPSB0cnVlO1xuICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSBBQ1RJVkVfQ0xBU1NfTkFNRTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIGRlYWN0aXZhdGUoKSB7XG4gICAgaWYgKHRoaXMuYWN0aXZlKSB7XG4gICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSBDTEFTU19OQU1FO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIG5leHQgc2libGluZy5cbiAgICpcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7RHJvcGRvd25JdGVtfVxuICAgKi9cbiAgZ2V0IG5leHQoKSB7XG4gICAgdmFyIG5leHRJbmRleCA9ICh0aGlzLmluZGV4ID09PSB0aGlzLnNpYmxpbmdzLmxlbmd0aCAtIDEgPyAwIDogdGhpcy5pbmRleCArIDEpO1xuICAgIHJldHVybiB0aGlzLnNpYmxpbmdzW25leHRJbmRleF07XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBwcmV2aW91cyBzaWJsaW5nLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEByZXR1cm5zIHtEcm9wZG93bkl0ZW19XG4gICAqL1xuICBnZXQgcHJldigpIHtcbiAgICB2YXIgcHJldkluZGV4ID0gKHRoaXMuaW5kZXggPT09IDAgPyB0aGlzLnNpYmxpbmdzLmxlbmd0aCA6IHRoaXMuaW5kZXgpIC0gMTtcbiAgICByZXR1cm4gdGhpcy5zaWJsaW5nc1twcmV2SW5kZXhdO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7TW91c2VFdmVudH0gZVxuICAgKi9cbiAgb25DbGljayhlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IGJsdXIgZXZlbnRcbiAgICB0aGlzLmRyb3Bkb3duLnNlbGVjdCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEcm9wZG93bkl0ZW07XG4iLCJpbXBvcnQgRHJvcGRvd25JdGVtIGZyb20gJy4vZHJvcGRvd24taXRlbSc7XG5pbXBvcnQge2NyZWF0ZUZyYWdtZW50fSBmcm9tICcuL3V0aWxzJztcblxuaW1wb3J0IGV4dGVuZCBmcm9tICdsb2Rhc2guYXNzaWduaW4nO1xuaW1wb3J0IHVuaXF1ZUlkIGZyb20gJ2xvZGFzaC51bmlxdWVpZCc7XG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNmdW5jdGlvbic7XG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuY29uc3QgREVGQVVMVF9DTEFTU19OQU1FID0gJ2Ryb3Bkb3duLW1lbnUgdGV4dGNvbXBsZXRlLWRyb3Bkb3duJztcblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSBEcm9wZG93bn5PZmZzZXRcbiAqIEBwcm9wIHtudW1iZXJ9IFt0b3BdXG4gKiBAcHJvcCB7bnVtYmVyfSBbbGVmdF1cbiAqIEBwcm9wIHtudW1iZXJ9IFtyaWdodF1cbiAqL1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIGEgZHJvcGRvd24gdmlldy5cbiAqXG4gKiBAcHJvcCB7Ym9vbGVhbn0gc2hvd24gLSBXaGV0aGVyIHRoZSAjZWwgaXMgc2hvd24gb3Igbm90LlxuICogQHByb3Age0Ryb3Bkb3duSXRlbVtdfSBpdGVtcyAtIFRoZSBhcnJheSBvZiByZW5kZXJlZCBkcm9wZG93biBpdGVtcy5cbiAqIEBleHRlbmRzIEV2ZW50RW1pdHRlclxuICovXG5jbGFzcyBEcm9wZG93biBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIC8qKlxuICAgKiBAcmV0dXJucyB7SFRNTFVMaXN0RWxlbWVudH1cbiAgICovXG4gIHN0YXRpYyBjcmVhdGVFbGVtZW50KCkge1xuICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3VsJyk7XG4gICAgZWwuaWQgPSB1bmlxdWVJZCgndGV4dGNvbXBsZXRlLWRyb3Bkb3duLScpO1xuICAgIGV4dGVuZChlbC5zdHlsZSwge1xuICAgICAgZGlzcGxheTogJ25vbmUnLFxuICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXG4gICAgICB6SW5kZXg6IDEwMDAwLFxuICAgIH0pO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZWwpO1xuICAgIHJldHVybiBlbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gW2NsYXNzTmFtZT1ERUZBVUxUX0NMQVNTX05BTUVdIC0gVGhlIGNsYXNzIGF0dHJpYnV0ZSBvZiB0aGUgZWwuXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb258c3RyaW5nfSBbZm9vdGVyXVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufHN0cmluZ30gW2hlYWRlcl1cbiAgICogQHBhcmFtIHtudW1iZXJ9IFttYXhDb3VudD0xMF1cbiAgICogQHBhcmFtIHtPYmplY3R9IFtzdHlsZV0gLSBUaGUgc3R5bGUgb2YgdGhlIGVsLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioe2NsYXNzTmFtZT1ERUZBVUxUX0NMQVNTX05BTUUsIGZvb3RlciwgaGVhZGVyLCBtYXhDb3VudD0xMCwgc3R5bGV9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnNob3duID0gZmFsc2U7XG4gICAgdGhpcy5pdGVtcyA9IFtdO1xuICAgIHRoaXMuZm9vdGVyID0gZm9vdGVyO1xuICAgIHRoaXMuaGVhZGVyID0gaGVhZGVyO1xuICAgIHRoaXMubWF4Q291bnQgPSBtYXhDb3VudDtcbiAgICB0aGlzLmVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgICBpZiAoc3R5bGUpIHtcbiAgICAgIGV4dGVuZCh0aGlzLmVsLnN0eWxlLCBzdHlsZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtIVE1MVUxpc3RFbGVtZW50fVxuICAgKi9cbiAgZ2V0IGVsKCkge1xuICAgIHRoaXMuX2VsIHx8ICh0aGlzLl9lbCA9IERyb3Bkb3duLmNyZWF0ZUVsZW1lbnQoKSk7XG4gICAgcmV0dXJuIHRoaXMuX2VsO1xuICB9XG5cbiAgLyoqXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAqL1xuICBnZXQgbGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW5kZXIgdGhlIGdpdmVuIGRhdGEgYXMgZHJvcGRvd24gaXRlbXMuXG4gICAqXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0W119IHNlYXJjaFJlc3VsdHNcbiAgICogQHBhcmFtIHtEcm9wZG93bn5PZmZzZXR9IGN1cnNvck9mZnNldFxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIHJlbmRlcihzZWFyY2hSZXN1bHRzLCBjdXJzb3JPZmZzZXQpIHtcbiAgICB2YXIgcmF3UmVzdWx0cyA9IFtdLCBkcm9wZG93bkl0ZW1zID0gW107XG4gICAgc2VhcmNoUmVzdWx0cy5mb3JFYWNoKHNlYXJjaFJlc3VsdCA9PiB7XG4gICAgICByYXdSZXN1bHRzLnB1c2goc2VhcmNoUmVzdWx0LmRhdGEpO1xuICAgICAgaWYgKGRyb3Bkb3duSXRlbXMubGVuZ3RoIDwgdGhpcy5tYXhDb3VudCkge1xuICAgICAgICBkcm9wZG93bkl0ZW1zLnB1c2gobmV3IERyb3Bkb3duSXRlbShzZWFyY2hSZXN1bHQpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmNsZWFyKClcbiAgICAgICAgLnJlbmRlckVkZ2UocmF3UmVzdWx0cywgJ2hlYWRlcicpXG4gICAgICAgIC5hcHBlbmQoZHJvcGRvd25JdGVtcylcbiAgICAgICAgLnJlbmRlckVkZ2UocmF3UmVzdWx0cywgJ2Zvb3RlcicpO1xuICAgIHJldHVybiB0aGlzLml0ZW1zLmxlbmd0aCA+IDAgPyB0aGlzLnNldE9mZnNldChjdXJzb3JPZmZzZXQpLnNob3coKSA6IHRoaXMuaGlkZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEhpZGUgdGhlIGRyb3Bkb3duIHRoZW4gc3dlZXAgb3V0IGl0ZW1zLlxuICAgKlxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIGRlYWN0aXZhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuaGlkZSgpLmNsZWFyKCk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtEcm9wZG93bkl0ZW19IGRyb3Bkb3duSXRlbVxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICogQGZpcmVzIERyb3Bkb3duI3NlbGVjdFxuICAgKi9cbiAgc2VsZWN0KGRyb3Bkb3duSXRlbSkge1xuICAgIC8qKlxuICAgICAqIEBldmVudCBEcm9wZG93biNzZWxlY3RcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcm9wIHtTZWFyY2hSZXN1bHR9IHNlYXJjaFJlc3VsdFxuICAgICAqL1xuICAgIHRoaXMuZW1pdCgnc2VsZWN0JywgeyBzZWFyY2hSZXN1bHQ6IGRyb3Bkb3duSXRlbS5zZWFyY2hSZXN1bHQgfSk7XG4gICAgcmV0dXJuIHRoaXMuZGVhY3RpdmF0ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKiBAZmlyZXMgRHJvcGRvd24jc2VsZWN0XG4gICAqL1xuICBzZWxlY3RBY3RpdmVJdGVtKGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuc2hvd24pIHtcbiAgICAgIHZhciBhY3RpdmVJdGVtID0gdGhpcy5nZXRBY3RpdmVJdGVtKCk7XG4gICAgICBpZiAoYWN0aXZlSXRlbSkge1xuICAgICAgICB0aGlzLnNlbGVjdChhY3RpdmVJdGVtKTtcbiAgICAgICAgY2FsbGJhY2soYWN0aXZlSXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgdXAoY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5tb3ZlQWN0aXZlSXRlbSgncHJldicsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIGRvd24oY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5tb3ZlQWN0aXZlSXRlbSgnbmV4dCcsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgaXRlbXMgdG8gZHJvcGRvd24uXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7RHJvcGRvd25JdGVtW119IGl0ZW1zXG4gICAqIEByZXR1cm5zIHt0aGlzfTtcbiAgICovXG4gIGFwcGVuZChpdGVtcykge1xuICAgIHZhciBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICBpdGVtcy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICB0aGlzLml0ZW1zLnB1c2goaXRlbSk7XG4gICAgICBpdGVtLmFwcGVuZGVkKHRoaXMpO1xuICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoaXRlbS5lbCk7XG4gICAgfSk7XG4gICAgdGhpcy5lbC5hcHBlbmRDaGlsZChmcmFnbWVudCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtEcm9wZG93bn5PZmZzZXR9IGN1cnNvck9mZnNldFxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIHNldE9mZnNldChjdXJzb3JPZmZzZXQpIHtcbiAgICBbJ3RvcCcsICdyaWdodCcsICdib3R0b20nLCAnbGVmdCddLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBpZiAoY3Vyc29yT2Zmc2V0Lmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIHRoaXMuZWwuc3R5bGVbbmFtZV0gPSBgJHtjdXJzb3JPZmZzZXRbbmFtZV19cHhgO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNob3cgdGhlIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKiBAZmlyZXMgRHJvcGRvd24jc2hvd1xuICAgKiBAZmlyZXMgRHJvcGRvd24jc2hvd25cbiAgICogQGZpcmVzIERyb3Bkb3duI3JlbmRlcmVkXG4gICAqL1xuICBzaG93KCkge1xuICAgIGlmICghdGhpcy5zaG93bikge1xuICAgICAgLyoqIEBldmVudCBEcm9wZG93biNzaG93ICovXG4gICAgICB0aGlzLmVtaXQoJ3Nob3cnKTtcbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICB0aGlzLnNob3duID0gdHJ1ZTtcbiAgICAgIC8qKiBAZXZlbnQgRHJvcGRvd24jc2hvd24gKi9cbiAgICAgIHRoaXMuZW1pdCgnc2hvd24nKTtcbiAgICB9XG4gICAgLyoqIEBldmVudCBEcm9wZG93biNyZW5kZXJlZCAqL1xuICAgIHRoaXMuZW1pdCgncmVuZGVyZWQnKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBIaWRlIHRoZSBlbGVtZW50LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICogQGZpcmVzIERyb3Bkb3duI2hpZGVcbiAgICogQGZpcmVzIERyb3Bkb3duI2hpZGRlblxuICAgKi9cbiAgaGlkZSgpIHtcbiAgICBpZiAodGhpcy5zaG93bikge1xuICAgICAgLyoqIEBldmVudCBEcm9wZG93biNoaWRlICovXG4gICAgICB0aGlzLmVtaXQoJ2hpZGUnKTtcbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHRoaXMuc2hvd24gPSBmYWxzZTtcbiAgICAgIC8qKiBAZXZlbnQgRHJvcGRvd24jaGlkZGVuICovXG4gICAgICB0aGlzLmVtaXQoJ2hpZGRlbicpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhciBzZWFyY2ggcmVzdWx0cy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBjbGVhcigpIHtcbiAgICB0aGlzLmVsLmlubmVySFRNTCA9ICcnO1xuICAgIHRoaXMuaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4geyBpdGVtLmZpbmFsaXplKCk7IH0pO1xuICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSB0aGUgYWN0aXZlIGl0ZW0uXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtEcm9wZG93bkl0ZW18dW5kZWZpbmVkfVxuICAgKi9cbiAgZ2V0QWN0aXZlSXRlbSgpIHtcbiAgICByZXR1cm4gdGhpcy5pdGVtcy5maW5kKChpdGVtKSA9PiB7IHJldHVybiBpdGVtLmFjdGl2ZTsgfSk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWVcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBtb3ZlQWN0aXZlSXRlbShuYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLnNob3duKSB7XG4gICAgICBsZXQgYWN0aXZlSXRlbSA9IHRoaXMuZ2V0QWN0aXZlSXRlbSgpO1xuICAgICAgaWYgKGFjdGl2ZUl0ZW0pIHtcbiAgICAgICAgYWN0aXZlSXRlbS5kZWFjdGl2YXRlKCk7XG4gICAgICAgIGNhbGxiYWNrKGFjdGl2ZUl0ZW1bbmFtZV0uYWN0aXZhdGUoKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7b2JqZWN0W119IHJhd1Jlc3VsdHMgLSBXaGF0IGNhbGxiYWNrZWQgYnkgc2VhcmNoIGZ1bmN0aW9uLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtICdoZWFkZXInIG9yICdmb290ZXInLlxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIHJlbmRlckVkZ2UocmF3UmVzdWx0cywgdHlwZSkge1xuICAgIHZhciBzb3VyY2UgPSB0aGlzW3R5cGVdO1xuICAgIGlmIChzb3VyY2UpIHtcbiAgICAgIGxldCBjb250ZW50ID0gaXNGdW5jdGlvbihzb3VyY2UpID8gc291cmNlKHJhd1Jlc3VsdHMpIDogc291cmNlO1xuICAgICAgbGV0IGZyYWdtZW50ID0gY3JlYXRlRnJhZ21lbnQoYDxsaSBjbGFzcz1cInRleHRjb21wbGV0ZS0ke3R5cGV9XCI+JHtjb250ZW50fTwvbGk+YCk7XG4gICAgICB0aGlzLmVsLmFwcGVuZENoaWxkKGZyYWdtZW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRHJvcGRvd247XG4iLCJpbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuZXhwb3J0IGNvbnN0IEVOVEVSID0gMDtcbmV4cG9ydCBjb25zdCBVUCA9IDE7XG5leHBvcnQgY29uc3QgRE9XTiA9IDI7XG5cbi8qKlxuICogQWJzdHJhY3QgY2xhc3MgcmVwcmVzZW50aW5nIGEgZWRpdG9yIHRhcmdldC5cbiAqXG4gKiBAYWJzdHJhY3RcbiAqIEBleHRlbmRzIEV2ZW50RW1pdHRlclxuICovXG5jbGFzcyBFZGl0b3IgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAvKipcbiAgICogQGV2ZW50IEVkaXRvciNtb3ZlXG4gICAqIEB0eXBlIHtvYmplY3R9XG4gICAqIEBwcm9wIHtudW1iZXJ9IGNvZGVcbiAgICogQHByb3Age2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cblxuICAvKipcbiAgICogQGV2ZW50IEVkaXRvciNjaGFuZ2VcbiAgICogQHR5cGUge29iamVjdH1cbiAgICogQHByb3Age3N0cmluZ30gYmVmb3JlQ3Vyc29yXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAZXZlbnQgRWRpdG9yI2JsdXJcbiAgICovXG5cbiAgLyoqXG4gICAqIEl0IGlzIGNhbGxlZCB3aGVuIGEgc2VhcmNoIHJlc3VsdCBpcyBzZWxlY3RlZCBieSBhIHVzZXIuXG4gICAqXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0fSBfc2VhcmNoUmVzdWx0XG4gICAqL1xuICBhcHBseVNlYXJjaFJlc3VsdChfc2VhcmNoUmVzdWx0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGlucHV0IGN1cnNvcidzIGFic29sdXRlIGNvb3JkaW5hdGVzIGZyb20gdGhlIHdpbmRvdydzIGxlZnRcbiAgICogdG9wIGNvcm5lci4gSXQgaXMgaW50ZW5kZWQgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWIgY2xhc3Nlcy5cbiAgICpcbiAgICogQHR5cGUge0Ryb3Bkb3dufk9mZnNldH1cbiAgICovXG4gIGdldCBjdXJzb3JPZmZzZXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRpdG9yO1xuIiwiaW1wb3J0IFNlYXJjaFJlc3VsdCBmcm9tICcuL3NlYXJjaC1yZXN1bHQnO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIG1hdGNoaW5nIGNvbmRpdGlvbiBiZXR3ZWVuIGEgU3RyYXRlZ3kgYW5kIGN1cnJlbnQgZWRpdG9yJ3MgdmFsdWUuXG4gKi9cbmNsYXNzIFF1ZXJ5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l9IHN0cmF0ZWd5XG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXJtXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IG1hdGNoXG4gICAqL1xuICBjb25zdHJ1Y3RvcihzdHJhdGVneSwgdGVybSwgbWF0Y2gpIHtcbiAgICB0aGlzLnN0cmF0ZWd5ID0gc3RyYXRlZ3k7XG4gICAgdGhpcy50ZXJtID0gdGVybTtcbiAgICB0aGlzLm1hdGNoID0gbWF0Y2g7XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlIHNlYXJjaCBzdHJhdGVneSBhbmQgY2FsbGJhY2sgdGhlIGdpdmVuIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBleGVjdXRlKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5zdHJhdGVneS5zZWFyY2goXG4gICAgICB0aGlzLnRlcm0sXG4gICAgICByZXN1bHRzID0+IHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0cy5tYXAocmVzdWx0ID0+IHtcbiAgICAgICAgICByZXR1cm4gbmV3IFNlYXJjaFJlc3VsdChyZXN1bHQsIHRoaXMudGVybSwgdGhpcy5zdHJhdGVneSk7XG4gICAgICAgIH0pKTtcbiAgICAgIH0sXG4gICAgICB0aGlzLm1hdGNoXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBRdWVyeTtcbiIsImNsYXNzIFNlYXJjaFJlc3VsdCB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIEFuIGVsZW1lbnQgb2YgYXJyYXkgY2FsbGJhY2tlZCBieSBzZWFyY2ggZnVuY3Rpb24uXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXJtXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l9IHN0cmF0ZWd5XG4gICAqL1xuICBjb25zdHJ1Y3RvcihkYXRhLCB0ZXJtLCBzdHJhdGVneSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgdGhpcy50ZXJtID0gdGVybTtcbiAgICB0aGlzLnN0cmF0ZWd5ID0gc3RyYXRlZ3k7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IGJlZm9yZUN1cnNvclxuICAgKiBAcGFyYW0ge3N0cmluZ30gYWZ0ZXJDdXJzb3JcbiAgICogQHJldHVybnMge3N0cmluZ1tdfHVuZGVmaW5lZH1cbiAgICovXG4gIHJlcGxhY2UoYmVmb3JlQ3Vyc29yLCBhZnRlckN1cnNvcikge1xuICAgIHZhciByZXBsYWNlbWVudCA9IHRoaXMuc3RyYXRlZ3kucmVwbGFjZSh0aGlzLmRhdGEpO1xuICAgIGlmIChyZXBsYWNlbWVudCAhPSBudWxsKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXBsYWNlbWVudCkpIHtcbiAgICAgICAgYWZ0ZXJDdXJzb3IgPSByZXBsYWNlbWVudFsxXSArIGFmdGVyQ3Vyc29yO1xuICAgICAgICByZXBsYWNlbWVudCA9IHJlcGxhY2VtZW50WzBdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFtiZWZvcmVDdXJzb3IucmVwbGFjZSh0aGlzLnN0cmF0ZWd5Lm1hdGNoLCByZXBsYWNlbWVudCksIGFmdGVyQ3Vyc29yXTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIHJlbmRlcigpIHtcbiAgICByZXR1cm4gdGhpcy5zdHJhdGVneS50ZW1wbGF0ZSh0aGlzLmRhdGEsIHRoaXMudGVybSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU2VhcmNoUmVzdWx0O1xuIiwiaW1wb3J0IFF1ZXJ5IGZyb20gJy4vcXVlcnknO1xuXG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNmdW5jdGlvbic7XG5pbXBvcnQgaXNTdHJpbmcgZnJvbSAnbG9kYXNoLmlzc3RyaW5nJztcblxuY29uc3QgREVGQVVMVF9JTkRFWCA9IDI7XG5cbmZ1bmN0aW9uIERFRkFVTFRfVEVNUExBVEUodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIFByb3BlcnRpZXMgb2YgdGhlIHN0cmF0ZWd5LlxuICpcbiAqIEB0eXBlZGVmIHtPYmplY3R9IFN0cmF0ZWd5flByb3BlcnRpZXNcbiAqIEBwcm9wIHtyZWdleHB8ZnVuY3Rpb259IG1hdGNoIC0gSWYgaXQgaXMgYSBmdW5jdGlvbiwgaXQgbXVzdCByZXR1cm4gYSBSZWdFeHAuXG4gKiBAcHJvcCB7ZnVuY3Rpb259IHNlYXJjaFxuICogQHByb3Age2Z1bmN0aW9ufSByZXBsYWNlXG4gKiBAcHJvcCB7ZnVuY3Rpb259IFtjb250ZXh0XVxuICogQHByb3Age2Z1bmN0aW9ufSBbdGVtcGxhdGVdXG4gKiBAcHJvcCB7Ym9vbGVhbn0gW2NhY2hlXVxuICogQHByb3Age251bWJlcn0gW2luZGV4PTJdXG4gKi9cblxuLyoqXG4gKiBFbmNhcHN1bGF0ZSBhIHNpbmdsZSBzdHJhdGVneS5cbiAqXG4gKiBAcHJvcCB7U3RyYXRlZ3l+UHJvcGVydGllc30gcHJvcHMgLSBJdHMgcHJvcGVydGllcy5cbiAqL1xuY2xhc3MgU3RyYXRlZ3kge1xuICAvKipcbiAgICogQHBhcmFtIHtTdHJhdGVneX5Qcm9wZXJ0aWVzfSBwcm9wc1xuICAgKi9cbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgdGhpcy5jYWNoZSA9IHByb3BzLmNhY2hlID8ge30gOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgUXVlcnkgb2JqZWN0IGJ5IHRoZSBnaXZlbiBzdHJpbmcgaWYgdGhpcyBtYXRjaGVzIHRvIHRoZSBzdHJpbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gSGVhZCB0byBpbnB1dCBjdXJzb3IuXG4gICAqIEByZXR1cm5zIHs/UXVlcnl9XG4gICAqL1xuICBidWlsZFF1ZXJ5KHRleHQpIHtcbiAgICBpZiAoaXNGdW5jdGlvbih0aGlzLnByb3BzLmNvbnRleHQpKSB7XG4gICAgICBsZXQgY29udGV4dCA9IHRoaXMucHJvcHMuY29udGV4dCh0ZXh0KTtcbiAgICAgIGlmIChpc1N0cmluZyhjb250ZXh0KSkge1xuICAgICAgICB0ZXh0ID0gY29udGV4dDtcbiAgICAgIH0gZWxzZSBpZiAoIWNvbnRleHQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBtYXRjaCA9IHRleHQubWF0Y2godGhpcy5nZXRNYXRjaFJlZ2V4cCh0ZXh0KSk7XG4gICAgcmV0dXJuIG1hdGNoID8gbmV3IFF1ZXJ5KHRoaXMsIG1hdGNoW3RoaXMuaW5kZXhdLCBtYXRjaCkgOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXJtXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSB7c3RyaW5nW119IG1hdGNoXG4gICAqL1xuICBzZWFyY2godGVybSwgY2FsbGJhY2ssIG1hdGNoKSB7XG4gICAgaWYgKHRoaXMuY2FjaGUpIHtcbiAgICAgIHRoaXMuc2VhcmNoV2l0aENhY2hlKHRlcm0sIGNhbGxiYWNrLCBtYXRjaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHJvcHMuc2VhcmNoKHRlcm0sIGNhbGxiYWNrLCBtYXRjaCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIC0gQW4gZWxlbWVudCBvZiBhcnJheSBjYWxsYmFja2VkIGJ5IHNlYXJjaCBmdW5jdGlvbi5cbiAgICogQHJldHVybnMge3N0cmluZ1tdfHN0cmluZ3xudWxsfVxuICAgKi9cbiAgcmVwbGFjZShkYXRhKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvcHMucmVwbGFjZShkYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGVybVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBtYXRjaFxuICAgKi9cbiAgc2VhcmNoV2l0aENhY2hlKHRlcm0sIGNhbGxiYWNrLCBtYXRjaCkge1xuICAgIHZhciBjYWNoZSA9IHRoaXMuY2FjaGVbdGVybV07XG4gICAgaWYgKGNhY2hlKSB7XG4gICAgICBjYWxsYmFjayhjYWNoZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHJvcHMuc2VhcmNoKHRlcm0sIHJlc3VsdHMgPT4ge1xuICAgICAgICB0aGlzLmNhY2hlW3Rlcm1dID0gcmVzdWx0cztcbiAgICAgICAgY2FsbGJhY2socmVzdWx0cyk7XG4gICAgICB9LCBtYXRjaCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm5zIHtSZWdFeHB9XG4gICAqL1xuICBnZXRNYXRjaFJlZ2V4cCh0ZXh0KSB7XG4gICAgcmV0dXJuIGlzRnVuY3Rpb24odGhpcy5tYXRjaCkgPyB0aGlzLm1hdGNoKHRleHQpIDogdGhpcy5tYXRjaDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7UmVnRXhwfEZ1bmN0aW9ufVxuICAgKi9cbiAgZ2V0IG1hdGNoKCkge1xuICAgIHJldHVybiB0aGlzLnByb3BzLm1hdGNoO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtOdW1iZXJ9XG4gICAqL1xuICBnZXQgaW5kZXgoKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvcHMuaW5kZXggfHwgREVGQVVMVF9JTkRFWDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7ZnVuY3Rpb259XG4gICAqL1xuICBnZXQgdGVtcGxhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvcHMudGVtcGxhdGUgfHwgREVGQVVMVF9URU1QTEFURTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTdHJhdGVneTtcbiIsImltcG9ydCBFZGl0b3IsIHtFTlRFUiwgVVAsIERPV059IGZyb20gJy4vZWRpdG9yJztcblxuY29uc3QgZ2V0Q2FyZXRDb29yZGluYXRlcyA9IHJlcXVpcmUoJ3RleHRhcmVhLWNhcmV0Jyk7XG5cbmNvbnN0IENBTExCQUNLX01FVEhPRFMgPSBbJ29uQmx1cicsICdvbktleWRvd24nLCAnb25LZXl1cCddO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIHRoZSB0YXJnZXQgdGV4dGFyZWEgZWxlbWVudC5cbiAqXG4gKiBAZXh0ZW5kcyBFZGl0b3JcbiAqIEBwcm9wIHtIVE1MVGV4dEFyZWFFbGVtZW50fSBlbCAtIFdoZXJlIHRoZSB0ZXh0Y29tcGxldGUgd29ya3Mgb24uXG4gKi9cbmNsYXNzIFRleHRhcmVhIGV4dGVuZHMgRWRpdG9yIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7SFRNTFRleHRBcmVhRWxlbWVudH0gZWxcbiAgICovXG4gIGNvbnN0cnVjdG9yKGVsKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmVsID0gZWw7XG5cbiAgICAvLyBCaW5kIGNhbGxiYWNrIG1ldGhvZHNcbiAgICBDQUxMQkFDS19NRVRIT0RTLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICB0aGlzW25hbWVdID0gdGhpc1tuYW1lXS5iaW5kKHRoaXMpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgdGhpcy5vbkJsdXIpO1xuICAgIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMub25LZXlkb3duKTtcbiAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5vbktleXVwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICogQHBhcmFtIHtTZWFyY2hSZXN1bHR9IHNlYXJjaFJlc3VsdFxuICAgKi9cbiAgYXBwbHlTZWFyY2hSZXN1bHQoc2VhcmNoUmVzdWx0KSB7XG4gICAgdmFyIHJlcGxhY2UgPSBzZWFyY2hSZXN1bHQucmVwbGFjZSh0aGlzLmJlZm9yZUN1cnNvciwgdGhpcy5hZnRlckN1cnNvcik7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVwbGFjZSkpIHtcbiAgICAgIHRoaXMuZWwudmFsdWUgPSByZXBsYWNlWzBdICsgcmVwbGFjZVsxXTtcbiAgICAgIHRoaXMuZWwuc2VsZWN0aW9uU3RhcnQgPSB0aGlzLmVsLnNlbGVjdGlvbkVuZCA9IHJlcGxhY2VbMF0ubGVuZ3RoO1xuICAgIH1cbiAgICB0aGlzLmVsLmZvY3VzKCk7IC8vIENsaWNraW5nIGEgZHJvcGRvd24gaXRlbSByZW1vdmVzIGZvY3VzIGZyb20gdGhlIGVsZW1lbnQuXG4gIH1cblxuICBnZXQgY3Vyc29yT2Zmc2V0KCkge1xuICAgIHZhciBlbE9mZnNldCA9IHRoaXMuZ2V0RWxPZmZzZXQoKTtcbiAgICB2YXIgZWxTY3JvbGwgPSB0aGlzLmdldEVsU2Nyb2xsKCk7XG4gICAgdmFyIGN1cnNvclBvc2l0aW9uID0gdGhpcy5nZXRDdXJzb3JQb3NpdGlvbigpO1xuICAgIHZhciB0b3AgPSBlbE9mZnNldC50b3AgLSBlbFNjcm9sbC50b3AgKyBjdXJzb3JQb3NpdGlvbi50b3AgKyB0aGlzLmdldEVsTGluZUhlaWdodCgpO1xuICAgIHZhciBsZWZ0ID0gZWxPZmZzZXQubGVmdCAtIGVsU2Nyb2xsLmxlZnQgKyBjdXJzb3JQb3NpdGlvbi5sZWZ0O1xuICAgIGlmICh0aGlzLmVsLmRpciAhPT0gJ3J0bCcpIHtcbiAgICAgIHJldHVybiB7IHRvcCwgbGVmdCB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4geyB0b3A6IHRvcCwgcmlnaHQ6IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCAtIGxlZnQgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhlIHN0cmluZyBmcm9tIGhlYWQgdG8gY3VycmVudCBpbnB1dCBjdXJzb3IgcG9zaXRpb24uXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAqL1xuICBnZXQgYmVmb3JlQ3Vyc29yKCkge1xuICAgIHJldHVybiB0aGlzLmVsLnZhbHVlLnN1YnN0cmluZygwLCB0aGlzLmVsLnNlbGVjdGlvbkVuZCk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIGdldCBhZnRlckN1cnNvcigpIHtcbiAgICByZXR1cm4gdGhpcy5lbC52YWx1ZS5zdWJzdHJpbmcodGhpcy5lbC5zZWxlY3Rpb25FbmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY3VycmVudCBjb29yZGluYXRlcyBvZiB0aGUgYCNlbGAgcmVsYXRpdmUgdG8gdGhlIGRvY3VtZW50LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7e3RvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXJ9fVxuICAgKi9cbiAgZ2V0RWxPZmZzZXQoKSB7XG4gICAgdmFyIHJlY3QgPSB0aGlzLmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHZhciBkb2N1bWVudEVsZW1lbnQgPSB0aGlzLmVsLm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuICAgIHJldHVybiB7XG4gICAgICB0b3A6IHJlY3QudG9wIC0gZG9jdW1lbnRFbGVtZW50LmNsaWVudFRvcCxcbiAgICAgIGxlZnQ6IHJlY3QubGVmdCAtIGRvY3VtZW50RWxlbWVudC5jbGllbnRMZWZ0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3t0b3A6IG51bWJlciwgbGVmdDogbnVtYmVyfX1cbiAgICovXG4gIGdldEVsU2Nyb2xsKCkge1xuICAgIHJldHVybiB7IHRvcDogdGhpcy5lbC5zY3JvbGxUb3AsIGxlZnQ6IHRoaXMuZWwuc2Nyb2xsTGVmdCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBpbnB1dCBjdXJzb3IncyByZWxhdGl2ZSBjb29yZGluYXRlcyBmcm9tIHRoZSB0ZXh0YXJlYSdzIGxlZnRcbiAgICogdG9wIGNvcm5lci5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3t0b3A6IG51bWJlciwgbGVmdDogbnVtYmVyfX1cbiAgICovXG4gIGdldEN1cnNvclBvc2l0aW9uKCkge1xuICAgIC8vIHRleHRhcmVhLWNhcmV0IHRocm93cyBhbiBlcnJvciBpZiBgd2luZG93YCBpcyB1bmRlZmluZWQuXG4gICAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID9cbiAgICAgIGdldENhcmV0Q29vcmRpbmF0ZXModGhpcy5lbCwgdGhpcy5lbC5zZWxlY3Rpb25FbmQpIDogeyB0b3A6IDAsIGxlZnQ6IDAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgZ2V0RWxMaW5lSGVpZ2h0KCkge1xuICAgIHZhciBjb21wdXRlZCA9IGRvY3VtZW50LmRlZmF1bHRWaWV3LmdldENvbXB1dGVkU3R5bGUodGhpcy5lbCk7XG4gICAgdmFyIGxpbmVIZWlnaHQgPSBwYXJzZUludChjb21wdXRlZC5saW5lSGVpZ2h0LCAxMCk7XG4gICAgcmV0dXJuIGlzTmFOKGxpbmVIZWlnaHQpID8gcGFyc2VJbnQoY29tcHV0ZWQuZm9udFNpemUsIDEwKSA6IGxpbmVIZWlnaHQ7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQGZpcmVzIEVkaXRvciNibHVyXG4gICAqIEBwYXJhbSB7Rm9jdXNFdmVudH0gX2VcbiAgICovXG4gIG9uQmx1cihfZSkge1xuICAgIHRoaXMuZW1pdCgnYmx1cicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBmaXJlcyBFZGl0b3IjbW92ZVxuICAgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcbiAgICovXG4gIG9uS2V5ZG93bihlKSB7XG4gICAgdmFyIGNvZGUgPSB0aGlzLmdldENvZGUoZSk7XG4gICAgaWYgKGNvZGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuZW1pdCgnbW92ZScsIHtcbiAgICAgICAgY29kZTogY29kZSxcbiAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQGZpcmVzIEVkaXRvciNjaGFuZ2VcbiAgICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBlXG4gICAqL1xuICBvbktleXVwKGUpIHtcbiAgICBpZiAoIXRoaXMuaXNNb3ZlS2V5RXZlbnQoZSkpIHtcbiAgICAgIHRoaXMuZW1pdCgnY2hhbmdlJywgeyBiZWZvcmVDdXJzb3I6IHRoaXMuYmVmb3JlQ3Vyc29yIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcbiAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAqL1xuICBpc01vdmVLZXlFdmVudChlKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29kZShlKSAhPT0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcbiAgICogQHJldHVybnMge0VOVEVSfFVQfERPV058bnVsbH1cbiAgICovXG4gIGdldENvZGUoZSkge1xuICAgIHJldHVybiBlLmtleUNvZGUgPT09IDEzID8gRU5URVJcbiAgICAgICAgIDogZS5rZXlDb2RlID09PSAzOCA/IFVQXG4gICAgICAgICA6IGUua2V5Q29kZSA9PT0gNDAgPyBET1dOXG4gICAgICAgICA6IGUua2V5Q29kZSA9PT0gNzggJiYgZS5jdHJsS2V5ID8gRE9XTlxuICAgICAgICAgOiBlLmtleUNvZGUgPT09IDgwICYmIGUuY3RybEtleSA/IFVQXG4gICAgICAgICA6IG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGV4dGFyZWE7XG4iLCJpbXBvcnQgQ29tcGxldGVyIGZyb20gJy4vY29tcGxldGVyJztcbmltcG9ydCBEcm9wZG93biBmcm9tICcuL2Ryb3Bkb3duJztcbmltcG9ydCBTdHJhdGVneSBmcm9tICcuL3N0cmF0ZWd5JztcbmltcG9ydCB7RU5URVIsIFVQLCBET1dOfSBmcm9tICcuL2VkaXRvcic7XG5pbXBvcnQge2xvY2t9IGZyb20gJy4vdXRpbHMnO1xuXG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNmdW5jdGlvbic7XG5pbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuY29uc3QgQ0FMTEJBQ0tfTUVUSE9EUyA9IFtcbiAgJ2hhbmRsZUJsdXInLFxuICAnaGFuZGxlQ2hhbmdlJyxcbiAgJ2hhbmRsZUhpdCcsXG4gICdoYW5kbGVNb3ZlJyxcbiAgJ2hhbmRsZVNlbGVjdCcsXG5dO1xuXG4vKipcbiAqIFRoZSBjb3JlIG9mIHRleHRjb21wbGV0ZS4gSXQgYWN0cyBhcyBhIG1lZGlhdG9yLlxuICpcbiAqIEBwcm9wIHtDb21wbGV0ZXJ9IGNvbXBsZXRlclxuICogQHByb3Age0Ryb3Bkb3dufSBkcm9wZG93blxuICogQHByb3Age0VkaXRvcn0gZWRpdG9yXG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqL1xuY2xhc3MgVGV4dGNvbXBsZXRlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7RWRpdG9yfSBlZGl0b3IgLSBXaGVyZSB0aGUgdGV4dGNvbXBsZXRlIHdvcmtzIG9uLlxuICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9uc1xuICAgKi9cbiAgY29uc3RydWN0b3IoZWRpdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5jb21wbGV0ZXIgPSBuZXcgQ29tcGxldGVyKCk7XG4gICAgdGhpcy5kcm9wZG93biA9IG5ldyBEcm9wZG93bihvcHRpb25zLmRyb3Bkb3duIHx8IHt9KTtcbiAgICB0aGlzLmVkaXRvciA9IGVkaXRvcjtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLy8gQmluZCBjYWxsYmFjayBtZXRob2RzXG4gICAgQ0FMTEJBQ0tfTUVUSE9EUy5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgdGhpc1tuYW1lXSA9IHRoaXNbbmFtZV0uYmluZCh0aGlzKTtcbiAgICB9KTtcblxuICAgIHRoaXMubG9ja2FibGVUcmlnZ2VyID0gbG9jayhmdW5jdGlvbiAoZnJlZSwgdGV4dCkge1xuICAgICAgdGhpcy5mcmVlID0gZnJlZTtcbiAgICAgIHRoaXMuY29tcGxldGVyLnJ1bih0ZXh0KTtcbiAgICB9KTtcblxuICAgIHRoaXMuc3RhcnRMaXN0ZW5pbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l+UHJvcGVydGllc1tdfSBzdHJhdGVneVByb3BzQXJyYXlcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqIEBleGFtcGxlXG4gICAqIHRleHRjb21wbGV0ZS5yZWdpc3Rlcihbe1xuICAgKiAgIG1hdGNoOiAvKF58XFxzKShcXHcrKSQvLFxuICAgKiAgIHNlYXJjaDogZnVuY3Rpb24gKHRlcm0sIGNhbGxiYWNrKSB7XG4gICAqICAgICAkLmFqYXgoeyAuLi4gfSlcbiAgICogICAgICAgLmRvbmUoY2FsbGJhY2spXG4gICAqICAgICAgIC5mYWlsKFtdKTtcbiAgICogICB9LFxuICAgKiAgIHJlcGxhY2U6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgKiAgICAgcmV0dXJuICckMScgKyB2YWx1ZSArICcgJztcbiAgICogICB9XG4gICAqIH1dKTtcbiAgICovXG4gIHJlZ2lzdGVyKHN0cmF0ZWd5UHJvcHNBcnJheSkge1xuICAgIHN0cmF0ZWd5UHJvcHNBcnJheS5mb3JFYWNoKChwcm9wcykgPT4ge1xuICAgICAgdGhpcy5jb21wbGV0ZXIucmVnaXN0ZXJTdHJhdGVneShuZXcgU3RyYXRlZ3kocHJvcHMpKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTdGFydCBhdXRvY29tcGxldGluZy5cbiAgICpcbiAgICogQHB1YmxpY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIEhlYWQgdG8gaW5wdXQgY3Vyc29yLlxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICogQGxpc3RlbnMgRWRpdG9yI2NoYW5nZVxuICAgKi9cbiAgdHJpZ2dlcih0ZXh0KSB7XG4gICAgdGhpcy5sb2NrYWJsZVRyaWdnZXIodGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogVW5sb2NrIHRyaWdnZXIgbWV0aG9kLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIHVubG9jaygpIHtcbiAgICAvLyBDYWxsaW5nIGZyZWUgZnVuY3Rpb24gbWF5IGFzc2lnbiBhIG5ldyBmdW5jdGlvbiB0byBgdGhpcy5mcmVlYC5cbiAgICAvLyBJdCBkZXBlbmRzIG9uIHdoZXRoZXIgZXh0cmEgZnVuY3Rpb24gY2FsbCB3YXMgbWFkZSBvciBub3QuXG4gICAgdmFyIGZyZWUgPSB0aGlzLmZyZWU7XG4gICAgdGhpcy5mcmVlID0gbnVsbDtcbiAgICBpZiAoaXNGdW5jdGlvbihmcmVlKSkgeyBmcmVlKCk7IH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdFtdfSBzZWFyY2hSZXN1bHRzXG4gICAqIEBsaXN0ZW5zIENvbXBsZXRlciNoaXRcbiAgICovXG4gIGhhbmRsZUhpdCh7c2VhcmNoUmVzdWx0c30pIHtcbiAgICBpZiAoc2VhcmNoUmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZHJvcGRvd24ucmVuZGVyKHNlYXJjaFJlc3VsdHMsIHRoaXMuZWRpdG9yLmN1cnNvck9mZnNldCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZHJvcGRvd24uZGVhY3RpdmF0ZSgpO1xuICAgIH1cbiAgICB0aGlzLnVubG9jaygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7RU5URVJ8VVB8RE9XTn0gY29kZVxuICAgKiBAcGFyYW0ge2Z1bmNpb259IGNhbGxiYWNrXG4gICAqIEBsaXN0ZW5zIEVkaXRvciNtb3ZlXG4gICAqL1xuICBoYW5kbGVNb3ZlKHtjb2RlLCBjYWxsYmFja30pIHtcbiAgICB2YXIgbWV0aG9kID0gY29kZSA9PT0gRU5URVIgPyAnc2VsZWN0QWN0aXZlSXRlbSdcbiAgICAgICAgICAgICAgIDogY29kZSA9PT0gVVAgPyAndXAnXG4gICAgICAgICAgICAgICA6IGNvZGUgPT09IERPV04gPyAnZG93bidcbiAgICAgICAgICAgICAgIDogbnVsbDtcbiAgICBpZiAoY29kZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5kcm9wZG93blttZXRob2RdKGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGJlZm9yZUN1cnNvclxuICAgKiBAbGlzdGVucyBFZGl0b3IjY2hhbmdlXG4gICAqL1xuICBoYW5kbGVDaGFuZ2Uoe2JlZm9yZUN1cnNvcn0pIHtcbiAgICB0aGlzLnRyaWdnZXIoYmVmb3JlQ3Vyc29yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbGlzdGVucyBFZGl0b3IjYmx1clxuICAgKi9cbiAgaGFuZGxlQmx1cigpIHtcbiAgICB0aGlzLmRyb3Bkb3duLmRlYWN0aXZhdGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdH0gc2VhcmNoUmVzdWx0XG4gICAqIEBsaXN0ZW5zIERyb3Bkb3duI3NlbGVjdFxuICAgKi9cbiAgaGFuZGxlU2VsZWN0KHtzZWFyY2hSZXN1bHR9KSB7XG4gICAgdGhpcy5lZGl0b3IuYXBwbHlTZWFyY2hSZXN1bHQoc2VhcmNoUmVzdWx0KTtcbiAgfVxuXG4gIC8qKiBAZXZlbnQgVGV4dGNvbXBsZXRlI3Nob3cgKi9cbiAgLyoqIEBldmVudCBUZXh0Y29tcGxldGUjc2hvd24gKi9cbiAgLyoqIEBldmVudCBUZXh0Y29tcGxldGUjcmVuZGVyZWQgKi9cbiAgLyoqIEBldmVudCBUZXh0Y29tcGxldGUjaGlkZSAqL1xuICAvKiogQGV2ZW50IFRleHRjb21wbGV0ZSNoaWRkZW4gKi9cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxuICAgKiBAcmV0dXJucyB7ZnVuY3Rpb259XG4gICAqL1xuICBidWlsZEhhbmRsZXIoZXZlbnROYW1lKSB7XG4gICAgcmV0dXJuICgpID0+IHsgdGhpcy5lbWl0KGV2ZW50TmFtZSk7IH07XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHN0YXJ0TGlzdGVuaW5nKCkge1xuICAgIHRoaXMuZWRpdG9yLm9uKCdtb3ZlJywgdGhpcy5oYW5kbGVNb3ZlKVxuICAgICAgICAgICAgICAgLm9uKCdjaGFuZ2UnLCB0aGlzLmhhbmRsZUNoYW5nZSlcbiAgICAgICAgICAgICAgIC5vbignYmx1cicsIHRoaXMuaGFuZGxlQmx1cik7XG4gICAgdGhpcy5kcm9wZG93bi5vbignc2VsZWN0JywgdGhpcy5oYW5kbGVTZWxlY3QpXG4gICAgICAgICAgICAgICAgIC5vbignc2hvdycsIHRoaXMuYnVpbGRIYW5kbGVyKCdzaG93JykpXG4gICAgICAgICAgICAgICAgIC5vbignc2hvd24nLCB0aGlzLmJ1aWxkSGFuZGxlcignc2hvd24nKSlcbiAgICAgICAgICAgICAgICAgLm9uKCdyZW5kZXJlZCcsIHRoaXMuYnVpbGRIYW5kbGVyKCdyZW5kZXJlZCcpKVxuICAgICAgICAgICAgICAgICAub24oJ2hpZGUnLCB0aGlzLmJ1aWxkSGFuZGxlcignaGlkZScpKVxuICAgICAgICAgICAgICAgICAub24oJ2hpZGRlbicsIHRoaXMuYnVpbGRIYW5kbGVyKCdoaWRkZW4nKSk7XG4gICAgdGhpcy5jb21wbGV0ZXIub24oJ2hpdCcsIHRoaXMuaGFuZGxlSGl0KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUZXh0Y29tcGxldGU7XG4iLCIvKipcbiAqIEV4Y2x1c2l2ZSBleGVjdXRpb24gY29udHJvbCB1dGlsaXR5LlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gYmUgbG9ja2VkLiBJdCBpcyBleGVjdXRlZCB3aXRoIGFcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBuYW1lZCBgZnJlZWAgYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiBPbmNlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgaXMgY2FsbGVkLCBhZGRpdGlvbmFsIGV4ZWN1dGlvbiBhcmUgaWdub3JlZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgIHVudGlsIHRoZSBmcmVlIGlzIGludm9rZWQuIFRoZW4gdGhlIGxhc3QgaWdub3JlZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWN1dGlvbiB3aWxsIGJlIHJlcGxheWVkIGltbWVkaWF0ZWx5LlxuICogQGV4YW1wbGVcbiAqIHZhciBsb2NrZWRGdW5jID0gbG9jayhmdW5jdGlvbiAoZnJlZSkge1xuICogICBzZXRUaW1lb3V0KGZ1bmN0aW9uIHsgZnJlZSgpOyB9LCAxMDAwKTsgLy8gSXQgd2lsbCBiZSBmcmVlIGluIDEgc2VjLlxuICogICBjb25zb2xlLmxvZygnSGVsbG8sIHdvcmxkJyk7XG4gKiB9KTtcbiAqIGxvY2tlZEZ1bmMoKTsgIC8vID0+ICdIZWxsbywgd29ybGQnXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyBub25lXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyBub25lXG4gKiAvLyAxIHNlYyBwYXN0IHRoZW5cbiAqIC8vID0+ICdIZWxsbywgd29ybGQnXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyA9PiAnSGVsbG8sIHdvcmxkJ1xuICogbG9ja2VkRnVuYygpOyAgLy8gbm9uZVxuICogQHJldHVybnMge2Z1bmN0aW9ufSBBIHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2NrKGZ1bmMpIHtcbiAgdmFyIGxvY2tlZCwgcXVldWVkQXJnc1RvUmVwbGF5O1xuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gQ29udmVydCBhcmd1bWVudHMgaW50byBhIHJlYWwgYXJyYXkuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIGlmIChsb2NrZWQpIHtcbiAgICAgIC8vIEtlZXAgYSBjb3B5IG9mIHRoaXMgYXJndW1lbnQgbGlzdCB0byByZXBsYXkgbGF0ZXIuXG4gICAgICAvLyBPSyB0byBvdmVyd3JpdGUgYSBwcmV2aW91cyB2YWx1ZSBiZWNhdXNlIHdlIG9ubHkgcmVwbGF5XG4gICAgICAvLyB0aGUgbGFzdCBvbmUuXG4gICAgICBxdWV1ZWRBcmdzVG9SZXBsYXkgPSBhcmdzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsb2NrZWQgPSB0cnVlO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiByZXBsYXlPckZyZWUoKSB7XG4gICAgICBpZiAocXVldWVkQXJnc1RvUmVwbGF5KSB7XG4gICAgICAgIC8vIE90aGVyIHJlcXVlc3QocykgYXJyaXZlZCB3aGlsZSB3ZSB3ZXJlIGxvY2tlZC5cbiAgICAgICAgLy8gTm93IHRoYXQgdGhlIGxvY2sgaXMgYmVjb21pbmcgYXZhaWxhYmxlLCByZXBsYXlcbiAgICAgICAgLy8gdGhlIGxhdGVzdCBzdWNoIHJlcXVlc3QsIHRoZW4gY2FsbCBiYWNrIGhlcmUgdG9cbiAgICAgICAgLy8gdW5sb2NrIChvciByZXBsYXkgYW5vdGhlciByZXF1ZXN0IHRoYXQgYXJyaXZlZFxuICAgICAgICAvLyB3aGlsZSB0aGlzIG9uZSB3YXMgaW4gZmxpZ2h0KS5cbiAgICAgICAgdmFyIHJlcGxheUFyZ3MgPSBxdWV1ZWRBcmdzVG9SZXBsYXk7XG4gICAgICAgIHF1ZXVlZEFyZ3NUb1JlcGxheSA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmVwbGF5QXJncy51bnNoaWZ0KHJlcGxheU9yRnJlZSk7XG4gICAgICAgIGZ1bmMuYXBwbHkoc2VsZiwgcmVwbGF5QXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NrZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXJncy51bnNoaWZ0KHJlcGxheU9yRnJlZSk7XG4gICAgZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkb2N1bWVudCBmcmFnbWVudCBieSB0aGUgZ2l2ZW4gSFRNTCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRhZ1N0cmluZ1xuICogQHJldHVybnMge0RvY3VtZW50RnJhZ21lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGcmFnbWVudCh0YWdTdHJpbmcpIHtcbiAgLy8gVE9ETyBJbXByZW1lbnQgd2l0aCBSYW5nZSNjcmVhdGVDb250ZXh0dWFsRnJhZ21lbnQgd2hlbiBpdCBkcm9wcyBJRTkgc3VwcG9ydC5cbiAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBkaXYuaW5uZXJIVE1MID0gdGFnU3RyaW5nO1xuICB2YXIgY2hpbGROb2RlcyA9IGRpdi5jaGlsZE5vZGVzO1xuICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGROb2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChjaGlsZE5vZGVzW2ldKTtcbiAgfVxuICByZXR1cm4gZnJhZ21lbnQ7XG59XG4iXX0=
