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
 * lodash 4.0.6 (Custom Build) <https://lodash.com/>
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

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/** Detect if properties shadowing those on `Object.prototype` are non-enumerable. */
var nonEnumShadows = !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf');

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
  return value != null && isLength(getLength(value)) && !isFunction(value);
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
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
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
  if (nonEnumShadows || isPrototype(source) || isArrayLike(source)) {
    copyObject(source, keysIn(source), object);
    return;
  }
  for (var key in source) {
    assignValue(object, key, source[key]);
  }
});

module.exports = assignIn;

},{"lodash.keysin":3,"lodash.rest":4}],3:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.3 (Custom Build) <https://lodash.com/>
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
  return value != null && isLength(getLength(value)) && !isFunction(value);
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
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
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
 * lodash 4.1.2 (Custom Build) <https://lodash.com/>
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
    symbolToString = symbolProto ? symbolProto.toString : undefined;

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
    return symbolToString ? symbolToString.call(value) : '';
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
 * @typedef {Object} Dropdown~Options
 * @prop {string} [className]
 * @prop {function|string} [footer]
 * @prop {function|string} [header]
 * @prop {number} [maxCount]
 * @prop {Object} [style]
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
   * @returns {HTMLUListElement} the dropdown element.
   */


  _createClass(Dropdown, [{
    key: 'render',


    /**
     * Render the given data as dropdown items.
     *
     * @param {SearchResult[]} searchResults
     * @param {Dropdown~Offset} cursorOffset
     * @returns {this}
     * @fires Dropdown#render
     * @fires Dropdown#rendered
     */
    value: function render(searchResults, cursorOffset) {
      var _this2 = this;

      /**
       * @event Dropdown#render
       * @type {CustomEvent}
       * @prop {function} preventDefault
       */
      var renderEvent = (0, _utils.createCustomEvent)('render', { cancelable: true });
      this.emit('render', renderEvent);
      if (renderEvent.defaultPrevented) {
        return this;
      }
      var rawResults = [],
          dropdownItems = [];
      searchResults.forEach(function (searchResult) {
        rawResults.push(searchResult.data);
        if (dropdownItems.length < _this2.maxCount) {
          dropdownItems.push(new _dropdownItem2.default(searchResult));
        }
      });
      this.clear().renderEdge(rawResults, 'header').append(dropdownItems).renderEdge(rawResults, 'footer').setOffset(cursorOffset).show();
      /**
       * @event Dropdown#rendered
       * @type {CustomEvent}
       */
      this.emit('rendered', (0, _utils.createCustomEvent)('rendered'));
      return this;
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
      var detail = { searchResult: dropdownItem.searchResult };
      /**
       * @event Dropdown#select
       * @type {CustomEvent}
       * @prop {function} preventDefault
       * @prop {object} detail
       * @prop {SearchResult} detail.searchResult
       */
      var selectEvent = (0, _utils.createCustomEvent)('select', { cancelable: true, detail: detail });
      this.emit('select', selectEvent);
      if (selectEvent.defaultPrevented) {
        return this;
      }
      this.deactivate();
      /**
       * @event Dropdown#selected
       * @type {CustomEvent}
       * @prop {object} detail
       * @prop {SearchResult} detail.searchResult
       */
      this.emit('selected', (0, _utils.createCustomEvent)('selected', { detail: detail }));
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
     * Retrieve the active item.
     *
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
     */

  }, {
    key: 'show',
    value: function show() {
      if (!this.shown) {
        /**
         * @event Dropdown#show
         * @type {CustomEvent}
         * @prop {function} preventDefault
         */
        var showEvent = (0, _utils.createCustomEvent)('show', { cancelable: true });
        this.emit('show', showEvent);
        if (showEvent.defaultPrevented) {
          return this;
        }
        this.el.style.display = 'block';
        this.shown = true;
        /**
         * @event Dropdown#shown
         * @type {CustomEvent}
         */
        this.emit('shown', (0, _utils.createCustomEvent)('shown'));
      }
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
        /**
         * @event Dropdown#hide
         * @type {CustomEvent}
         * @prop {function} preventDefault
         */
        var hideEvent = (0, _utils.createCustomEvent)('hide', { cancelable: true });
        this.emit('hide', hideEvent);
        if (hideEvent.defaultPrevented) {
          return this;
        }
        this.el.style.display = 'none';
        this.shown = false;
        /**
         * @event Dropdown#hidden
         * @type {CustomEvent}
         */
        this.emit('hidden', (0, _utils.createCustomEvent)('hidden'));
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
     * @private
     * @param {string} name - "next" or "prev".
     * @param {function} callback
     * @returns {this}
     */

  }, {
    key: 'moveActiveItem',
    value: function moveActiveItem(name, callback) {
      if (this.shown) {
        var activeItem = this.getActiveItem();
        var nextActiveItem = void 0;
        if (activeItem) {
          activeItem.deactivate();
          nextActiveItem = activeItem[name];
        } else {
          nextActiveItem = name === 'next' ? this.items[0] : this.items[this.items.length - 1];
        }
        if (nextActiveItem) {
          callback(nextActiveItem.activate());
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
 * Properties for a strategy.
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

var CALLBACK_METHODS = ['onKeydown', 'onKeyup'];

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
      var code = this.getCode(e);
      return code !== _editor.ENTER && code !== null;
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

var CALLBACK_METHODS = ['handleChange', 'handleHit', 'handleMove', 'handleSelect'];

/**
 * Options for a textcomplete.
 *
 * @typedef {Object} Textcomplete~Options
 * @prop {Dropdown~Options} dropdown
 */

/**
 * The core of textcomplete. It acts as a mediator.
 *
 * @prop {Completer} completer
 * @prop {Dropdown} dropdown
 * @prop {Editor} editor
 * @extends EventEmitter
 * @tutorial getting-started
 */

var Textcomplete = function (_EventEmitter) {
  _inherits(Textcomplete, _EventEmitter);

  /**
   * @param {Editor} editor - Where the textcomplete works on.
   * @param {Textcomplete~Options} options
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

      switch (code) {
        case _editor.ENTER:
          var activeItem = this.dropdown.getActiveItem();
          if (activeItem) {
            this.dropdown.select(activeItem);
            callback(activeItem);
          }
          break;
        case _editor.UP:
          this.dropdown.up(callback);
          break;
        case _editor.DOWN:
          this.dropdown.down(callback);
          break;
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
     * @param {Dropdown#select} selectEvent
     * @listens Dropdown#select
     */

  }, {
    key: 'handleSelect',
    value: function handleSelect(selectEvent) {
      this.emit('select', selectEvent);
      if (!selectEvent.defaultPrevented) {
        this.editor.applySearchResult(selectEvent.detail.searchResult);
      }
    }

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
      var _this4 = this;

      this.editor.on('move', this.handleMove).on('change', this.handleChange);
      this.dropdown.on('select', this.handleSelect);
      ['show', 'shown', 'render', 'rendered', 'selected', 'hidden', 'hide'].forEach(function (eventName) {
        _this4.dropdown.on(eventName, _this4.buildHandler(eventName));
      });
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
exports.createCustomEvent = createCustomEvent;

var _lodash = require('lodash.assignin');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

/**
 * @param {string} type
 * @param {Object} [options]
 * @param {Object} [options.detail=undefined]
 * @param {Boolean} [options.cancelable=false]
 * @returns {CustomEvent}
 */
function createCustomEvent(type, options) {
  return new document.defaultView.CustomEvent(type, (0, _lodash2.default)({
    cancelable: false,
    detail: undefined
  }, options));
}

},{"lodash.assignin":2}]},{},[11])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2guYXNzaWduaW4vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmFzc2lnbmluL25vZGVfbW9kdWxlcy9sb2Rhc2gua2V5c2luL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC5hc3NpZ25pbi9ub2RlX21vZHVsZXMvbG9kYXNoLnJlc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzZnVuY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvbG9kYXNoLmlzc3RyaW5nL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvZGFzaC51bmlxdWVpZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sb2Rhc2gudW5pcXVlaWQvbm9kZV9tb2R1bGVzL2xvZGFzaC50b3N0cmluZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90ZXh0YXJlYS1jYXJldC9pbmRleC5qcyIsInNyYy9jb21wbGV0ZXIuanMiLCJzcmMvZG9jL21haW4uanMiLCJzcmMvZHJvcGRvd24taXRlbS5qcyIsInNyYy9kcm9wZG93bi5qcyIsInNyYy9lZGl0b3IuanMiLCJzcmMvcXVlcnkuanMiLCJzcmMvc2VhcmNoLXJlc3VsdC5qcyIsInNyYy9zdHJhdGVneS5qcyIsInNyYy90ZXh0YXJlYS5qcyIsInNyYy90ZXh0Y29tcGxldGUuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdFlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNWVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QUosRUFBTyxHQUE5QyxFQUFtRDtBQUNqRCxhQUFTLFdBQVQsQ0FBcUIsV0FBVyxDQUFYLENBQXJCLEVBRGlEO0dBQW5EO0FBR0EsU0FBTyxRQUFQLENBVHdDO0NBQW5DOzs7Ozs7Ozs7QUFtQkEsU0FBUyxpQkFBVCxDQUEyQixJQUEzQixFQUFpQyxPQUFqQyxFQUEwQztBQUMvQyxTQUFPLElBQUksU0FBUyxXQUFULENBQXFCLFdBQXJCLENBQWlDLElBQXJDLEVBQTJDLHNCQUFPO0FBQ3ZELGdCQUFZLEtBQVo7QUFDQSxZQUFRLFNBQVI7R0FGZ0QsRUFHL0MsT0FIK0MsQ0FBM0MsQ0FBUCxDQUQrQztDQUExQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKipcbiAqIGxvZGFzaCA0LjAuNiAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG52YXIga2V5c0luID0gcmVxdWlyZSgnbG9kYXNoLmtleXNpbicpLFxuICAgIHJlc3QgPSByZXF1aXJlKCdsb2Rhc2gucmVzdCcpO1xuXG4vKiogVXNlZCBhcyByZWZlcmVuY2VzIGZvciB2YXJpb3VzIGBOdW1iZXJgIGNvbnN0YW50cy4gKi9cbnZhciBNQVhfU0FGRV9JTlRFR0VSID0gOTAwNzE5OTI1NDc0MDk5MTtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCB1bnNpZ25lZCBpbnRlZ2VyIHZhbHVlcy4gKi9cbnZhciByZUlzVWludCA9IC9eKD86MHxbMS05XVxcZCopJC87XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBhcnJheS1saWtlIGluZGV4LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoPU1BWF9TQUZFX0lOVEVHRVJdIFRoZSB1cHBlciBib3VuZHMgb2YgYSB2YWxpZCBpbmRleC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgdmFsaWQgaW5kZXgsIGVsc2UgYGZhbHNlYC5cbiAqL1xuZnVuY3Rpb24gaXNJbmRleCh2YWx1ZSwgbGVuZ3RoKSB7XG4gIHZhbHVlID0gKHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fCByZUlzVWludC50ZXN0KHZhbHVlKSkgPyArdmFsdWUgOiAtMTtcbiAgbGVuZ3RoID0gbGVuZ3RoID09IG51bGwgPyBNQVhfU0FGRV9JTlRFR0VSIDogbGVuZ3RoO1xuICByZXR1cm4gdmFsdWUgPiAtMSAmJiB2YWx1ZSAlIDEgPT0gMCAmJiB2YWx1ZSA8IGxlbmd0aDtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgcHJvcGVydHlJc0VudW1lcmFibGUgPSBvYmplY3RQcm90by5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuLyoqIERldGVjdCBpZiBwcm9wZXJ0aWVzIHNoYWRvd2luZyB0aG9zZSBvbiBgT2JqZWN0LnByb3RvdHlwZWAgYXJlIG5vbi1lbnVtZXJhYmxlLiAqL1xudmFyIG5vbkVudW1TaGFkb3dzID0gIXByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwoeyAndmFsdWVPZic6IDEgfSwgJ3ZhbHVlT2YnKTtcblxuLyoqXG4gKiBBc3NpZ25zIGB2YWx1ZWAgdG8gYGtleWAgb2YgYG9iamVjdGAgaWYgdGhlIGV4aXN0aW5nIHZhbHVlIGlzIG5vdCBlcXVpdmFsZW50XG4gKiB1c2luZyBbYFNhbWVWYWx1ZVplcm9gXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1zYW1ldmFsdWV6ZXJvKVxuICogZm9yIGVxdWFsaXR5IGNvbXBhcmlzb25zLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gbW9kaWZ5LlxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBhc3NpZ24uXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBhc3NpZ24uXG4gKi9cbmZ1bmN0aW9uIGFzc2lnblZhbHVlKG9iamVjdCwga2V5LCB2YWx1ZSkge1xuICB2YXIgb2JqVmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgaWYgKCEoaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGtleSkgJiYgZXEob2JqVmFsdWUsIHZhbHVlKSkgfHxcbiAgICAgICh2YWx1ZSA9PT0gdW5kZWZpbmVkICYmICEoa2V5IGluIG9iamVjdCkpKSB7XG4gICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgfVxufVxuXG4vKipcbiAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnByb3BlcnR5YCB3aXRob3V0IHN1cHBvcnQgZm9yIGRlZXAgcGF0aHMuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgcHJvcGVydHkgdG8gZ2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGJhc2VQcm9wZXJ0eShrZXkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgPT0gbnVsbCA/IHVuZGVmaW5lZCA6IG9iamVjdFtrZXldO1xuICB9O1xufVxuXG4vKipcbiAqIENvcGllcyBwcm9wZXJ0aWVzIG9mIGBzb3VyY2VgIHRvIGBvYmplY3RgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gc291cmNlIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIGZyb20uXG4gKiBAcGFyYW0ge0FycmF5fSBwcm9wcyBUaGUgcHJvcGVydHkgbmFtZXMgdG8gY29weS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0PXt9XSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyB0by5cbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXG4gKi9cbmZ1bmN0aW9uIGNvcHlPYmplY3Qoc291cmNlLCBwcm9wcywgb2JqZWN0KSB7XG4gIHJldHVybiBjb3B5T2JqZWN0V2l0aChzb3VyY2UsIHByb3BzLCBvYmplY3QpO1xufVxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gaXMgbGlrZSBgY29weU9iamVjdGAgZXhjZXB0IHRoYXQgaXQgYWNjZXB0cyBhIGZ1bmN0aW9uIHRvXG4gKiBjdXN0b21pemUgY29waWVkIHZhbHVlcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb2JqZWN0IHRvIGNvcHkgcHJvcGVydGllcyBmcm9tLlxuICogQHBhcmFtIHtBcnJheX0gcHJvcHMgVGhlIHByb3BlcnR5IG5hbWVzIHRvIGNvcHkuXG4gKiBAcGFyYW0ge09iamVjdH0gW29iamVjdD17fV0gVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgdG8uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY3VzdG9taXplcl0gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjb3BpZWQgdmFsdWVzLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqL1xuZnVuY3Rpb24gY29weU9iamVjdFdpdGgoc291cmNlLCBwcm9wcywgb2JqZWN0LCBjdXN0b21pemVyKSB7XG4gIG9iamVjdCB8fCAob2JqZWN0ID0ge30pO1xuXG4gIHZhciBpbmRleCA9IC0xLFxuICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcblxuICAgIHZhciBuZXdWYWx1ZSA9IGN1c3RvbWl6ZXJcbiAgICAgID8gY3VzdG9taXplcihvYmplY3Rba2V5XSwgc291cmNlW2tleV0sIGtleSwgb2JqZWN0LCBzb3VyY2UpXG4gICAgICA6IHNvdXJjZVtrZXldO1xuXG4gICAgYXNzaWduVmFsdWUob2JqZWN0LCBrZXksIG5ld1ZhbHVlKTtcbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiBsaWtlIGBfLmFzc2lnbmAuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGFzc2lnbmVyIFRoZSBmdW5jdGlvbiB0byBhc3NpZ24gdmFsdWVzLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYXNzaWduZXIgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUFzc2lnbmVyKGFzc2lnbmVyKSB7XG4gIHJldHVybiByZXN0KGZ1bmN0aW9uKG9iamVjdCwgc291cmNlcykge1xuICAgIHZhciBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBzb3VyY2VzLmxlbmd0aCxcbiAgICAgICAgY3VzdG9taXplciA9IGxlbmd0aCA+IDEgPyBzb3VyY2VzW2xlbmd0aCAtIDFdIDogdW5kZWZpbmVkLFxuICAgICAgICBndWFyZCA9IGxlbmd0aCA+IDIgPyBzb3VyY2VzWzJdIDogdW5kZWZpbmVkO1xuXG4gICAgY3VzdG9taXplciA9IHR5cGVvZiBjdXN0b21pemVyID09ICdmdW5jdGlvbidcbiAgICAgID8gKGxlbmd0aC0tLCBjdXN0b21pemVyKVxuICAgICAgOiB1bmRlZmluZWQ7XG5cbiAgICBpZiAoZ3VhcmQgJiYgaXNJdGVyYXRlZUNhbGwoc291cmNlc1swXSwgc291cmNlc1sxXSwgZ3VhcmQpKSB7XG4gICAgICBjdXN0b21pemVyID0gbGVuZ3RoIDwgMyA/IHVuZGVmaW5lZCA6IGN1c3RvbWl6ZXI7XG4gICAgICBsZW5ndGggPSAxO1xuICAgIH1cbiAgICBvYmplY3QgPSBPYmplY3Qob2JqZWN0KTtcbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgdmFyIHNvdXJjZSA9IHNvdXJjZXNbaW5kZXhdO1xuICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICBhc3NpZ25lcihvYmplY3QsIHNvdXJjZSwgaW5kZXgsIGN1c3RvbWl6ZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xuICB9KTtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSBcImxlbmd0aFwiIHByb3BlcnR5IHZhbHVlIG9mIGBvYmplY3RgLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgdG8gYXZvaWQgYSBbSklUIGJ1Z10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE0Mjc5MilcbiAqIHRoYXQgYWZmZWN0cyBTYWZhcmkgb24gYXQgbGVhc3QgaU9TIDguMS04LjMgQVJNNjQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBcImxlbmd0aFwiIHZhbHVlLlxuICovXG52YXIgZ2V0TGVuZ3RoID0gYmFzZVByb3BlcnR5KCdsZW5ndGgnKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgdGhlIGdpdmVuIGFyZ3VtZW50cyBhcmUgZnJvbSBhbiBpdGVyYXRlZSBjYWxsLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgdmFsdWUgYXJndW1lbnQuXG4gKiBAcGFyYW0geyp9IGluZGV4IFRoZSBwb3RlbnRpYWwgaXRlcmF0ZWUgaW5kZXggb3Iga2V5IGFyZ3VtZW50LlxuICogQHBhcmFtIHsqfSBvYmplY3QgVGhlIHBvdGVudGlhbCBpdGVyYXRlZSBvYmplY3QgYXJndW1lbnQuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGFyZ3VtZW50cyBhcmUgZnJvbSBhbiBpdGVyYXRlZSBjYWxsLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzSXRlcmF0ZWVDYWxsKHZhbHVlLCBpbmRleCwgb2JqZWN0KSB7XG4gIGlmICghaXNPYmplY3Qob2JqZWN0KSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgdHlwZSA9IHR5cGVvZiBpbmRleDtcbiAgaWYgKHR5cGUgPT0gJ251bWJlcidcbiAgICAgID8gKGlzQXJyYXlMaWtlKG9iamVjdCkgJiYgaXNJbmRleChpbmRleCwgb2JqZWN0Lmxlbmd0aCkpXG4gICAgICA6ICh0eXBlID09ICdzdHJpbmcnICYmIGluZGV4IGluIG9iamVjdCkpIHtcbiAgICByZXR1cm4gZXEob2JqZWN0W2luZGV4XSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBsaWtlbHkgYSBwcm90b3R5cGUgb2JqZWN0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgcHJvdG90eXBlLCBlbHNlIGBmYWxzZWAuXG4gKi9cbmZ1bmN0aW9uIGlzUHJvdG90eXBlKHZhbHVlKSB7XG4gIHZhciBDdG9yID0gdmFsdWUgJiYgdmFsdWUuY29uc3RydWN0b3IsXG4gICAgICBwcm90byA9ICh0eXBlb2YgQ3RvciA9PSAnZnVuY3Rpb24nICYmIEN0b3IucHJvdG90eXBlKSB8fCBvYmplY3RQcm90bztcblxuICByZXR1cm4gdmFsdWUgPT09IHByb3RvO1xufVxuXG4vKipcbiAqIFBlcmZvcm1zIGEgW2BTYW1lVmFsdWVaZXJvYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtc2FtZXZhbHVlemVybylcbiAqIGNvbXBhcmlzb24gYmV0d2VlbiB0d28gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZSBlcXVpdmFsZW50LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7Kn0gb3RoZXIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiB2YXIgb2JqZWN0ID0geyAndXNlcic6ICdmcmVkJyB9O1xuICogdmFyIG90aGVyID0geyAndXNlcic6ICdmcmVkJyB9O1xuICpcbiAqIF8uZXEob2JqZWN0LCBvYmplY3QpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uZXEob2JqZWN0LCBvdGhlcik7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uZXEoJ2EnLCAnYScpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uZXEoJ2EnLCBPYmplY3QoJ2EnKSk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uZXEoTmFOLCBOYU4pO1xuICogLy8gPT4gdHJ1ZVxuICovXG5mdW5jdGlvbiBlcSh2YWx1ZSwgb3RoZXIpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBvdGhlciB8fCAodmFsdWUgIT09IHZhbHVlICYmIG90aGVyICE9PSBvdGhlcik7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZS4gQSB2YWx1ZSBpcyBjb25zaWRlcmVkIGFycmF5LWxpa2UgaWYgaXQnc1xuICogbm90IGEgZnVuY3Rpb24gYW5kIGhhcyBhIGB2YWx1ZS5sZW5ndGhgIHRoYXQncyBhbiBpbnRlZ2VyIGdyZWF0ZXIgdGhhbiBvclxuICogZXF1YWwgdG8gYDBgIGFuZCBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYXJyYXktbGlrZSwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5TGlrZShkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKCdhYmMnKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiBpc0xlbmd0aChnZXRMZW5ndGgodmFsdWUpKSAmJiAhaXNGdW5jdGlvbih2YWx1ZSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGFuZCB3ZWFrIG1hcCBjb25zdHJ1Y3RvcnMsXG4gIC8vIGFuZCBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGxvb3NlbHkgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0xlbmd0aCgzKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTGVuZ3RoKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKEluZmluaXR5KTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aCgnMycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJlxuICAgIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmFzc2lnbmAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBvd24gYW5kXG4gKiBpbmhlcml0ZWQgc291cmNlIHByb3BlcnRpZXMuXG4gKlxuICogKipOb3RlOioqIFRoaXMgbWV0aG9kIG11dGF0ZXMgYG9iamVjdGAuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBhbGlhcyBleHRlbmRcbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAqIEBwYXJhbSB7Li4uT2JqZWN0fSBbc291cmNlc10gVGhlIHNvdXJjZSBvYmplY3RzLlxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cbiAqIEBleGFtcGxlXG4gKlxuICogZnVuY3Rpb24gRm9vKCkge1xuICogICB0aGlzLmIgPSAyO1xuICogfVxuICpcbiAqIGZ1bmN0aW9uIEJhcigpIHtcbiAqICAgdGhpcy5kID0gNDtcbiAqIH1cbiAqXG4gKiBGb28ucHJvdG90eXBlLmMgPSAzO1xuICogQmFyLnByb3RvdHlwZS5lID0gNTtcbiAqXG4gKiBfLmFzc2lnbkluKHsgJ2EnOiAxIH0sIG5ldyBGb28sIG5ldyBCYXIpO1xuICogLy8gPT4geyAnYSc6IDEsICdiJzogMiwgJ2MnOiAzLCAnZCc6IDQsICdlJzogNSB9XG4gKi9cbnZhciBhc3NpZ25JbiA9IGNyZWF0ZUFzc2lnbmVyKGZ1bmN0aW9uKG9iamVjdCwgc291cmNlKSB7XG4gIGlmIChub25FbnVtU2hhZG93cyB8fCBpc1Byb3RvdHlwZShzb3VyY2UpIHx8IGlzQXJyYXlMaWtlKHNvdXJjZSkpIHtcbiAgICBjb3B5T2JqZWN0KHNvdXJjZSwga2V5c0luKHNvdXJjZSksIG9iamVjdCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICBhc3NpZ25WYWx1ZShvYmplY3QsIGtleSwgc291cmNlW2tleV0pO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBhc3NpZ25JbjtcbiIsIi8qKlxuICogbG9kYXNoIDQuMS4zIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgYXMgcmVmZXJlbmNlcyBmb3IgdmFyaW91cyBgTnVtYmVyYCBjb25zdGFudHMuICovXG52YXIgTUFYX1NBRkVfSU5URUdFUiA9IDkwMDcxOTkyNTQ3NDA5OTE7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBhcmdzVGFnID0gJ1tvYmplY3QgQXJndW1lbnRzXScsXG4gICAgZnVuY1RhZyA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgZ2VuVGFnID0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJyxcbiAgICBzdHJpbmdUYWcgPSAnW29iamVjdCBTdHJpbmddJztcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IHVuc2lnbmVkIGludGVnZXIgdmFsdWVzLiAqL1xudmFyIHJlSXNVaW50ID0gL14oPzowfFsxLTldXFxkKikkLztcblxuLyoqIFVzZWQgdG8gZGV0ZXJtaW5lIGlmIHZhbHVlcyBhcmUgb2YgdGhlIGxhbmd1YWdlIHR5cGUgYE9iamVjdGAuICovXG52YXIgb2JqZWN0VHlwZXMgPSB7XG4gICdmdW5jdGlvbic6IHRydWUsXG4gICdvYmplY3QnOiB0cnVlXG59O1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxuICA/IGV4cG9ydHNcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxuICA/IG1vZHVsZVxuICA6IHVuZGVmaW5lZDtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcblxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcblxuLyoqXG4gKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXG4gKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cbiAqL1xudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XG4gICgoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxuICAgIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy50aW1lc2Agd2l0aG91dCBzdXBwb3J0IGZvciBpdGVyYXRlZSBzaG9ydGhhbmRzXG4gKiBvciBtYXggYXJyYXkgbGVuZ3RoIGNoZWNrcy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtudW1iZXJ9IG4gVGhlIG51bWJlciBvZiB0aW1lcyB0byBpbnZva2UgYGl0ZXJhdGVlYC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGl0ZXJhdGVlIFRoZSBmdW5jdGlvbiBpbnZva2VkIHBlciBpdGVyYXRpb24uXG4gKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIGFycmF5IG9mIHJlc3VsdHMuXG4gKi9cbmZ1bmN0aW9uIGJhc2VUaW1lcyhuLCBpdGVyYXRlZSkge1xuICB2YXIgaW5kZXggPSAtMSxcbiAgICAgIHJlc3VsdCA9IEFycmF5KG4pO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgbikge1xuICAgIHJlc3VsdFtpbmRleF0gPSBpdGVyYXRlZShpbmRleCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGdsb2JhbCBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge251bGx8T2JqZWN0fSBSZXR1cm5zIGB2YWx1ZWAgaWYgaXQncyBhIGdsb2JhbCBvYmplY3QsIGVsc2UgYG51bGxgLlxuICovXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgaW5kZXguXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHtudW1iZXJ9IFtsZW5ndGg9TUFYX1NBRkVfSU5URUdFUl0gVGhlIHVwcGVyIGJvdW5kcyBvZiBhIHZhbGlkIGluZGV4LlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBpbmRleCwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc0luZGV4KHZhbHVlLCBsZW5ndGgpIHtcbiAgdmFsdWUgPSAodHlwZW9mIHZhbHVlID09ICdudW1iZXInIHx8IHJlSXNVaW50LnRlc3QodmFsdWUpKSA/ICt2YWx1ZSA6IC0xO1xuICBsZW5ndGggPSBsZW5ndGggPT0gbnVsbCA/IE1BWF9TQUZFX0lOVEVHRVIgOiBsZW5ndGg7XG4gIHJldHVybiB2YWx1ZSA+IC0xICYmIHZhbHVlICUgMSA9PSAwICYmIHZhbHVlIDwgbGVuZ3RoO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGBpdGVyYXRvcmAgdG8gYW4gYXJyYXkuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBpdGVyYXRvciBUaGUgaXRlcmF0b3IgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgY29udmVydGVkIGFycmF5LlxuICovXG5mdW5jdGlvbiBpdGVyYXRvclRvQXJyYXkoaXRlcmF0b3IpIHtcbiAgdmFyIGRhdGEsXG4gICAgICByZXN1bHQgPSBbXTtcblxuICB3aGlsZSAoIShkYXRhID0gaXRlcmF0b3IubmV4dCgpKS5kb25lKSB7XG4gICAgcmVzdWx0LnB1c2goZGF0YS52YWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqIFVzZWQgdG8gY2hlY2sgb2JqZWN0cyBmb3Igb3duIHByb3BlcnRpZXMuICovXG52YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3RQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgUmVmbGVjdCA9IHJvb3QuUmVmbGVjdCxcbiAgICBlbnVtZXJhdGUgPSBSZWZsZWN0ID8gUmVmbGVjdC5lbnVtZXJhdGUgOiB1bmRlZmluZWQsXG4gICAgcHJvcGVydHlJc0VudW1lcmFibGUgPSBvYmplY3RQcm90by5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuLyoqXG4gKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5rZXlzSW5gIHdoaWNoIGRvZXNuJ3Qgc2tpcCB0aGUgY29uc3RydWN0b3JcbiAqIHByb3BlcnR5IG9mIHByb3RvdHlwZXMgb3IgdHJlYXQgc3BhcnNlIGFycmF5cyBhcyBkZW5zZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIHF1ZXJ5LlxuICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIHRoZSBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqL1xuZnVuY3Rpb24gYmFzZUtleXNJbihvYmplY3QpIHtcbiAgb2JqZWN0ID0gb2JqZWN0ID09IG51bGwgPyBvYmplY3QgOiBPYmplY3Qob2JqZWN0KTtcblxuICB2YXIgcmVzdWx0ID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICByZXN1bHQucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIEZhbGxiYWNrIGZvciBJRSA8IDkgd2l0aCBlczYtc2hpbS5cbmlmIChlbnVtZXJhdGUgJiYgIXByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwoeyAndmFsdWVPZic6IDEgfSwgJ3ZhbHVlT2YnKSkge1xuICBiYXNlS2V5c0luID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIGl0ZXJhdG9yVG9BcnJheShlbnVtZXJhdGUob2JqZWN0KSk7XG4gIH07XG59XG5cbi8qKlxuICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8ucHJvcGVydHlgIHdpdGhvdXQgc3VwcG9ydCBmb3IgZGVlcCBwYXRocy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBwcm9wZXJ0eSB0byBnZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gYmFzZVByb3BlcnR5KGtleSkge1xuICByZXR1cm4gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgcmV0dXJuIG9iamVjdCA9PSBudWxsID8gdW5kZWZpbmVkIDogb2JqZWN0W2tleV07XG4gIH07XG59XG5cbi8qKlxuICogR2V0cyB0aGUgXCJsZW5ndGhcIiBwcm9wZXJ0eSB2YWx1ZSBvZiBgb2JqZWN0YC5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyB1c2VkIHRvIGF2b2lkIGEgW0pJVCBidWddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNDI3OTIpXG4gKiB0aGF0IGFmZmVjdHMgU2FmYXJpIG9uIGF0IGxlYXN0IGlPUyA4LjEtOC4zIEFSTTY0LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gcXVlcnkuXG4gKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgXCJsZW5ndGhcIiB2YWx1ZS5cbiAqL1xudmFyIGdldExlbmd0aCA9IGJhc2VQcm9wZXJ0eSgnbGVuZ3RoJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSBvZiBpbmRleCBrZXlzIGZvciBgb2JqZWN0YCB2YWx1ZXMgb2YgYXJyYXlzLFxuICogYGFyZ3VtZW50c2Agb2JqZWN0cywgYW5kIHN0cmluZ3MsIG90aGVyd2lzZSBgbnVsbGAgaXMgcmV0dXJuZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheXxudWxsfSBSZXR1cm5zIGluZGV4IGtleXMsIGVsc2UgYG51bGxgLlxuICovXG5mdW5jdGlvbiBpbmRleEtleXMob2JqZWN0KSB7XG4gIHZhciBsZW5ndGggPSBvYmplY3QgPyBvYmplY3QubGVuZ3RoIDogdW5kZWZpbmVkO1xuICBpZiAoaXNMZW5ndGgobGVuZ3RoKSAmJlxuICAgICAgKGlzQXJyYXkob2JqZWN0KSB8fCBpc1N0cmluZyhvYmplY3QpIHx8IGlzQXJndW1lbnRzKG9iamVjdCkpKSB7XG4gICAgcmV0dXJuIGJhc2VUaW1lcyhsZW5ndGgsIFN0cmluZyk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgbGlrZWx5IGEgcHJvdG90eXBlIG9iamVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHByb3RvdHlwZSwgZWxzZSBgZmFsc2VgLlxuICovXG5mdW5jdGlvbiBpc1Byb3RvdHlwZSh2YWx1ZSkge1xuICB2YXIgQ3RvciA9IHZhbHVlICYmIHZhbHVlLmNvbnN0cnVjdG9yLFxuICAgICAgcHJvdG8gPSAodHlwZW9mIEN0b3IgPT0gJ2Z1bmN0aW9uJyAmJiBDdG9yLnByb3RvdHlwZSkgfHwgb2JqZWN0UHJvdG87XG5cbiAgcmV0dXJuIHZhbHVlID09PSBwcm90bztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBsaWtlbHkgYW4gYGFyZ3VtZW50c2Agb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzQXJndW1lbnRzKGZ1bmN0aW9uKCkgeyByZXR1cm4gYXJndW1lbnRzOyB9KCkpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcmd1bWVudHMoWzEsIDIsIDNdKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJndW1lbnRzKHZhbHVlKSB7XG4gIC8vIFNhZmFyaSA4LjEgaW5jb3JyZWN0bHkgbWFrZXMgYGFyZ3VtZW50cy5jYWxsZWVgIGVudW1lcmFibGUgaW4gc3RyaWN0IG1vZGUuXG4gIHJldHVybiBpc0FycmF5TGlrZU9iamVjdCh2YWx1ZSkgJiYgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ2NhbGxlZScpICYmXG4gICAgKCFwcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHZhbHVlLCAnY2FsbGVlJykgfHwgb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJnc1RhZyk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhbiBgQXJyYXlgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHR5cGUge0Z1bmN0aW9ufVxuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0FycmF5KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0FycmF5KGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzQXJyYXkoJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzQXJyYXkoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLiBBIHZhbHVlIGlzIGNvbnNpZGVyZWQgYXJyYXktbGlrZSBpZiBpdCdzXG4gKiBub3QgYSBmdW5jdGlvbiBhbmQgaGFzIGEgYHZhbHVlLmxlbmd0aGAgdGhhdCdzIGFuIGludGVnZXIgZ3JlYXRlciB0aGFuIG9yXG4gKiBlcXVhbCB0byBgMGAgYW5kIGxlc3MgdGhhbiBvciBlcXVhbCB0byBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhcnJheS1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlKGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoJ2FiYycpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlMaWtlKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPSBudWxsICYmIGlzTGVuZ3RoKGdldExlbmd0aCh2YWx1ZSkpICYmICFpc0Z1bmN0aW9uKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmlzQXJyYXlMaWtlYCBleGNlcHQgdGhhdCBpdCBhbHNvIGNoZWNrcyBpZiBgdmFsdWVgXG4gKiBpcyBhbiBvYmplY3QuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIGFycmF5LWxpa2Ugb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KGRvY3VtZW50LmJvZHkuY2hpbGRyZW4pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheUxpa2VPYmplY3QoJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzQXJyYXlMaWtlT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5TGlrZU9iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBpc0FycmF5TGlrZSh2YWx1ZSk7XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGFuZCB3ZWFrIG1hcCBjb25zdHJ1Y3RvcnMsXG4gIC8vIGFuZCBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGFycmF5LWxpa2UgbGVuZ3RoLlxuICpcbiAqICoqTm90ZToqKiBUaGlzIGZ1bmN0aW9uIGlzIGxvb3NlbHkgYmFzZWQgb24gW2BUb0xlbmd0aGBdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvbGVuZ3RoKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSB2YWxpZCBsZW5ndGgsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0xlbmd0aCgzKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzTGVuZ3RoKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gZmFsc2VcbiAqXG4gKiBfLmlzTGVuZ3RoKEluZmluaXR5KTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0xlbmd0aCgnMycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNMZW5ndGgodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyAmJlxuICAgIHZhbHVlID4gLTEgJiYgdmFsdWUgJSAxID09IDAgJiYgdmFsdWUgPD0gTUFYX1NBRkVfSU5URUdFUjtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS4gQSB2YWx1ZSBpcyBvYmplY3QtbGlrZSBpZiBpdCdzIG5vdCBgbnVsbGBcbiAqIGFuZCBoYXMgYSBgdHlwZW9mYCByZXN1bHQgb2YgXCJvYmplY3RcIi5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc09iamVjdExpa2Uoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdExpa2UoXy5ub29wKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc09iamVjdExpa2UobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWUpIHtcbiAgcmV0dXJuICEhdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgU3RyaW5nYCBwcmltaXRpdmUgb3Igb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzU3RyaW5nKCdhYmMnKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzU3RyaW5nKDEpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTdHJpbmcodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyB8fFxuICAgICghaXNBcnJheSh2YWx1ZSkgJiYgaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA9PSBzdHJpbmdUYWcpO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgdGhlIG93biBhbmQgaW5oZXJpdGVkIGVudW1lcmFibGUgcHJvcGVydHkgbmFtZXMgb2YgYG9iamVjdGAuXG4gKlxuICogKipOb3RlOioqIE5vbi1vYmplY3QgdmFsdWVzIGFyZSBjb2VyY2VkIHRvIG9iamVjdHMuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBxdWVyeS5cbiAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGZ1bmN0aW9uIEZvbygpIHtcbiAqICAgdGhpcy5hID0gMTtcbiAqICAgdGhpcy5iID0gMjtcbiAqIH1cbiAqXG4gKiBGb28ucHJvdG90eXBlLmMgPSAzO1xuICpcbiAqIF8ua2V5c0luKG5ldyBGb28pO1xuICogLy8gPT4gWydhJywgJ2InLCAnYyddIChpdGVyYXRpb24gb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQpXG4gKi9cbmZ1bmN0aW9uIGtleXNJbihvYmplY3QpIHtcbiAgdmFyIGluZGV4ID0gLTEsXG4gICAgICBpc1Byb3RvID0gaXNQcm90b3R5cGUob2JqZWN0KSxcbiAgICAgIHByb3BzID0gYmFzZUtleXNJbihvYmplY3QpLFxuICAgICAgcHJvcHNMZW5ndGggPSBwcm9wcy5sZW5ndGgsXG4gICAgICBpbmRleGVzID0gaW5kZXhLZXlzKG9iamVjdCksXG4gICAgICBza2lwSW5kZXhlcyA9ICEhaW5kZXhlcyxcbiAgICAgIHJlc3VsdCA9IGluZGV4ZXMgfHwgW10sXG4gICAgICBsZW5ndGggPSByZXN1bHQubGVuZ3RoO1xuXG4gIHdoaWxlICgrK2luZGV4IDwgcHJvcHNMZW5ndGgpIHtcbiAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xuICAgIGlmICghKHNraXBJbmRleGVzICYmIChrZXkgPT0gJ2xlbmd0aCcgfHwgaXNJbmRleChrZXksIGxlbmd0aCkpKSAmJlxuICAgICAgICAhKGtleSA9PSAnY29uc3RydWN0b3InICYmIChpc1Byb3RvIHx8ICFoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwga2V5KSkpKSB7XG4gICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGtleXNJbjtcbiIsIi8qKlxuICogbG9kYXNoIDQuMC4xIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cblxuLyoqIFVzZWQgYXMgdGhlIGBUeXBlRXJyb3JgIG1lc3NhZ2UgZm9yIFwiRnVuY3Rpb25zXCIgbWV0aG9kcy4gKi9cbnZhciBGVU5DX0VSUk9SX1RFWFQgPSAnRXhwZWN0ZWQgYSBmdW5jdGlvbic7XG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIElORklOSVRZID0gMSAvIDAsXG4gICAgTUFYX0lOVEVHRVIgPSAxLjc5NzY5MzEzNDg2MjMxNTdlKzMwOCxcbiAgICBOQU4gPSAwIC8gMDtcblxuLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCByZWZlcmVuY2VzLiAqL1xudmFyIGZ1bmNUYWcgPSAnW29iamVjdCBGdW5jdGlvbl0nLFxuICAgIGdlblRhZyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG5cbi8qKiBVc2VkIHRvIG1hdGNoIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHdoaXRlc3BhY2UuICovXG52YXIgcmVUcmltID0gL15cXHMrfFxccyskL2c7XG5cbi8qKiBVc2VkIHRvIGRldGVjdCBiYWQgc2lnbmVkIGhleGFkZWNpbWFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JhZEhleCA9IC9eWy0rXTB4WzAtOWEtZl0rJC9pO1xuXG4vKiogVXNlZCB0byBkZXRlY3QgYmluYXJ5IHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc0JpbmFyeSA9IC9eMGJbMDFdKyQvaTtcblxuLyoqIFVzZWQgdG8gZGV0ZWN0IG9jdGFsIHN0cmluZyB2YWx1ZXMuICovXG52YXIgcmVJc09jdGFsID0gL14wb1swLTddKyQvaTtcblxuLyoqIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIHdpdGhvdXQgYSBkZXBlbmRlbmN5IG9uIGByb290YC4gKi9cbnZhciBmcmVlUGFyc2VJbnQgPSBwYXJzZUludDtcblxuLyoqXG4gKiBBIGZhc3RlciBhbHRlcm5hdGl2ZSB0byBgRnVuY3Rpb24jYXBwbHlgLCB0aGlzIGZ1bmN0aW9uIGludm9rZXMgYGZ1bmNgXG4gKiB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiBgdGhpc0FyZ2AgYW5kIHRoZSBhcmd1bWVudHMgb2YgYGFyZ3NgLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBpbnZva2UuXG4gKiBAcGFyYW0geyp9IHRoaXNBcmcgVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cbiAqIEBwYXJhbSB7Li4uKn0gYXJncyBUaGUgYXJndW1lbnRzIHRvIGludm9rZSBgZnVuY2Agd2l0aC5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYGZ1bmNgLlxuICovXG5mdW5jdGlvbiBhcHBseShmdW5jLCB0aGlzQXJnLCBhcmdzKSB7XG4gIHZhciBsZW5ndGggPSBhcmdzLmxlbmd0aDtcbiAgc3dpdGNoIChsZW5ndGgpIHtcbiAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZyk7XG4gICAgY2FzZSAxOiByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFyZ3NbMF0pO1xuICAgIGNhc2UgMjogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCBhcmdzWzBdLCBhcmdzWzFdKTtcbiAgICBjYXNlIDM6IHJldHVybiBmdW5jLmNhbGwodGhpc0FyZywgYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSk7XG4gIH1cbiAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XG59XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qIEJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzIGZvciB0aG9zZSB3aXRoIHRoZSBzYW1lIG5hbWUgYXMgb3RoZXIgYGxvZGFzaGAgbWV0aG9kcy4gKi9cbnZhciBuYXRpdmVNYXggPSBNYXRoLm1heDtcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCB3aXRoIHRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGVcbiAqIGNyZWF0ZWQgZnVuY3Rpb24gYW5kIGFyZ3VtZW50cyBmcm9tIGBzdGFydGAgYW5kIGJleW9uZCBwcm92aWRlZCBhcyBhbiBhcnJheS5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBtZXRob2QgaXMgYmFzZWQgb24gdGhlIFtyZXN0IHBhcmFtZXRlcl0oaHR0cHM6Ly9tZG4uaW8vcmVzdF9wYXJhbWV0ZXJzKS5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IEZ1bmN0aW9uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBhcHBseSBhIHJlc3QgcGFyYW1ldGVyIHRvLlxuICogQHBhcmFtIHtudW1iZXJ9IFtzdGFydD1mdW5jLmxlbmd0aC0xXSBUaGUgc3RhcnQgcG9zaXRpb24gb2YgdGhlIHJlc3QgcGFyYW1ldGVyLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXG4gKiBAZXhhbXBsZVxuICpcbiAqIHZhciBzYXkgPSBfLnJlc3QoZnVuY3Rpb24od2hhdCwgbmFtZXMpIHtcbiAqICAgcmV0dXJuIHdoYXQgKyAnICcgKyBfLmluaXRpYWwobmFtZXMpLmpvaW4oJywgJykgK1xuICogICAgIChfLnNpemUobmFtZXMpID4gMSA/ICcsICYgJyA6ICcnKSArIF8ubGFzdChuYW1lcyk7XG4gKiB9KTtcbiAqXG4gKiBzYXkoJ2hlbGxvJywgJ2ZyZWQnLCAnYmFybmV5JywgJ3BlYmJsZXMnKTtcbiAqIC8vID0+ICdoZWxsbyBmcmVkLCBiYXJuZXksICYgcGViYmxlcydcbiAqL1xuZnVuY3Rpb24gcmVzdChmdW5jLCBzdGFydCkge1xuICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoRlVOQ19FUlJPUl9URVhUKTtcbiAgfVxuICBzdGFydCA9IG5hdGl2ZU1heChzdGFydCA9PT0gdW5kZWZpbmVkID8gKGZ1bmMubGVuZ3RoIC0gMSkgOiB0b0ludGVnZXIoc3RhcnQpLCAwKTtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxuICAgICAgICBpbmRleCA9IC0xLFxuICAgICAgICBsZW5ndGggPSBuYXRpdmVNYXgoYXJncy5sZW5ndGggLSBzdGFydCwgMCksXG4gICAgICAgIGFycmF5ID0gQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG4gICAgICBhcnJheVtpbmRleF0gPSBhcmdzW3N0YXJ0ICsgaW5kZXhdO1xuICAgIH1cbiAgICBzd2l0Y2ggKHN0YXJ0KSB7XG4gICAgICBjYXNlIDA6IHJldHVybiBmdW5jLmNhbGwodGhpcywgYXJyYXkpO1xuICAgICAgY2FzZSAxOiByZXR1cm4gZnVuYy5jYWxsKHRoaXMsIGFyZ3NbMF0sIGFycmF5KTtcbiAgICAgIGNhc2UgMjogcmV0dXJuIGZ1bmMuY2FsbCh0aGlzLCBhcmdzWzBdLCBhcmdzWzFdLCBhcnJheSk7XG4gICAgfVxuICAgIHZhciBvdGhlckFyZ3MgPSBBcnJheShzdGFydCArIDEpO1xuICAgIGluZGV4ID0gLTE7XG4gICAgd2hpbGUgKCsraW5kZXggPCBzdGFydCkge1xuICAgICAgb3RoZXJBcmdzW2luZGV4XSA9IGFyZ3NbaW5kZXhdO1xuICAgIH1cbiAgICBvdGhlckFyZ3Nbc3RhcnRdID0gYXJyYXk7XG4gICAgcmV0dXJuIGFwcGx5KGZ1bmMsIHRoaXMsIG90aGVyQXJncyk7XG4gIH07XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhIGBGdW5jdGlvbmAgb2JqZWN0LlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBjb3JyZWN0bHkgY2xhc3NpZmllZCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzRnVuY3Rpb24oXyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc0Z1bmN0aW9uKC9hYmMvKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgLy8gVGhlIHVzZSBvZiBgT2JqZWN0I3RvU3RyaW5nYCBhdm9pZHMgaXNzdWVzIHdpdGggdGhlIGB0eXBlb2ZgIG9wZXJhdG9yXG4gIC8vIGluIFNhZmFyaSA4IHdoaWNoIHJldHVybnMgJ29iamVjdCcgZm9yIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycywgYW5kXG4gIC8vIFBoYW50b21KUyAxLjkgd2hpY2ggcmV0dXJucyAnZnVuY3Rpb24nIGZvciBgTm9kZUxpc3RgIGluc3RhbmNlcy5cbiAgdmFyIHRhZyA9IGlzT2JqZWN0KHZhbHVlKSA/IG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpIDogJyc7XG4gIHJldHVybiB0YWcgPT0gZnVuY1RhZyB8fCB0YWcgPT0gZ2VuVGFnO1xufVxuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIHRoZSBbbGFuZ3VhZ2UgdHlwZV0oaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OCkgb2YgYE9iamVjdGAuXG4gKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYW4gb2JqZWN0LCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3Qoe30pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QoWzEsIDIsIDNdKTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KF8ubm9vcCk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChudWxsKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gISF2YWx1ZSAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGB2YWx1ZWAgdG8gYW4gaW50ZWdlci5cbiAqXG4gKiAqKk5vdGU6KiogVGhpcyBmdW5jdGlvbiBpcyBsb29zZWx5IGJhc2VkIG9uIFtgVG9JbnRlZ2VyYF0oaHR0cDovL3d3dy5lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLXRvaW50ZWdlcikuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgY29udmVydGVkIGludGVnZXIuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udG9JbnRlZ2VyKDMpO1xuICogLy8gPT4gM1xuICpcbiAqIF8udG9JbnRlZ2VyKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gMFxuICpcbiAqIF8udG9JbnRlZ2VyKEluZmluaXR5KTtcbiAqIC8vID0+IDEuNzk3NjkzMTM0ODYyMzE1N2UrMzA4XG4gKlxuICogXy50b0ludGVnZXIoJzMnKTtcbiAqIC8vID0+IDNcbiAqL1xuZnVuY3Rpb24gdG9JbnRlZ2VyKHZhbHVlKSB7XG4gIGlmICghdmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IDAgPyB2YWx1ZSA6IDA7XG4gIH1cbiAgdmFsdWUgPSB0b051bWJlcih2YWx1ZSk7XG4gIGlmICh2YWx1ZSA9PT0gSU5GSU5JVFkgfHwgdmFsdWUgPT09IC1JTkZJTklUWSkge1xuICAgIHZhciBzaWduID0gKHZhbHVlIDwgMCA/IC0xIDogMSk7XG4gICAgcmV0dXJuIHNpZ24gKiBNQVhfSU5URUdFUjtcbiAgfVxuICB2YXIgcmVtYWluZGVyID0gdmFsdWUgJSAxO1xuICByZXR1cm4gdmFsdWUgPT09IHZhbHVlID8gKHJlbWFpbmRlciA/IHZhbHVlIC0gcmVtYWluZGVyIDogdmFsdWUpIDogMDtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBgdmFsdWVgIHRvIGEgbnVtYmVyLlxuICpcbiAqIEBzdGF0aWNcbiAqIEBtZW1iZXJPZiBfXG4gKiBAY2F0ZWdvcnkgTGFuZ1xuICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcHJvY2Vzcy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlci5cbiAqIEBleGFtcGxlXG4gKlxuICogXy50b051bWJlcigzKTtcbiAqIC8vID0+IDNcbiAqXG4gKiBfLnRvTnVtYmVyKE51bWJlci5NSU5fVkFMVUUpO1xuICogLy8gPT4gNWUtMzI0XG4gKlxuICogXy50b051bWJlcihJbmZpbml0eSk7XG4gKiAvLyA9PiBJbmZpbml0eVxuICpcbiAqIF8udG9OdW1iZXIoJzMnKTtcbiAqIC8vID0+IDNcbiAqL1xuZnVuY3Rpb24gdG9OdW1iZXIodmFsdWUpIHtcbiAgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgIHZhciBvdGhlciA9IGlzRnVuY3Rpb24odmFsdWUudmFsdWVPZikgPyB2YWx1ZS52YWx1ZU9mKCkgOiB2YWx1ZTtcbiAgICB2YWx1ZSA9IGlzT2JqZWN0KG90aGVyKSA/IChvdGhlciArICcnKSA6IG90aGVyO1xuICB9XG4gIGlmICh0eXBlb2YgdmFsdWUgIT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWUgPT09IDAgPyB2YWx1ZSA6ICt2YWx1ZTtcbiAgfVxuICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UocmVUcmltLCAnJyk7XG4gIHZhciBpc0JpbmFyeSA9IHJlSXNCaW5hcnkudGVzdCh2YWx1ZSk7XG4gIHJldHVybiAoaXNCaW5hcnkgfHwgcmVJc09jdGFsLnRlc3QodmFsdWUpKVxuICAgID8gZnJlZVBhcnNlSW50KHZhbHVlLnNsaWNlKDIpLCBpc0JpbmFyeSA/IDIgOiA4KVxuICAgIDogKHJlSXNCYWRIZXgudGVzdCh2YWx1ZSkgPyBOQU4gOiArdmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc3Q7XG4iLCIvKipcbiAqIGxvZGFzaCAzLjAuOCAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBmdW5jVGFnID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgICBnZW5UYWcgPSAnW29iamVjdCBHZW5lcmF0b3JGdW5jdGlvbl0nO1xuXG4vKiogVXNlZCBmb3IgYnVpbHQtaW4gbWV0aG9kIHJlZmVyZW5jZXMuICovXG52YXIgb2JqZWN0UHJvdG8gPSBPYmplY3QucHJvdG90eXBlO1xuXG4vKipcbiAqIFVzZWQgdG8gcmVzb2x2ZSB0aGUgW2B0b1N0cmluZ1RhZ2BdKGh0dHA6Ly9lY21hLWludGVybmF0aW9uYWwub3JnL2VjbWEtMjYyLzYuMC8jc2VjLW9iamVjdC5wcm90b3R5cGUudG9zdHJpbmcpXG4gKiBvZiB2YWx1ZXMuXG4gKi9cbnZhciBvYmplY3RUb1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGNsYXNzaWZpZWQgYXMgYSBgRnVuY3Rpb25gIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc0Z1bmN0aW9uKF8pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNGdW5jdGlvbigvYWJjLyk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHZhbHVlKSB7XG4gIC8vIFRoZSB1c2Ugb2YgYE9iamVjdCN0b1N0cmluZ2AgYXZvaWRzIGlzc3VlcyB3aXRoIHRoZSBgdHlwZW9mYCBvcGVyYXRvclxuICAvLyBpbiBTYWZhcmkgOCB3aGljaCByZXR1cm5zICdvYmplY3QnIGZvciB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMsIGFuZFxuICAvLyBQaGFudG9tSlMgMS45IHdoaWNoIHJldHVybnMgJ2Z1bmN0aW9uJyBmb3IgYE5vZGVMaXN0YCBpbnN0YW5jZXMuXG4gIHZhciB0YWcgPSBpc09iamVjdCh2YWx1ZSkgPyBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA6ICcnO1xuICByZXR1cm4gdGFnID09IGZ1bmNUYWcgfHwgdGFnID09IGdlblRhZztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgW2xhbmd1YWdlIHR5cGVdKGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDgpIG9mIGBPYmplY3RgLlxuICogKGUuZy4gYXJyYXlzLCBmdW5jdGlvbnMsIG9iamVjdHMsIHJlZ2V4ZXMsIGBuZXcgTnVtYmVyKDApYCwgYW5kIGBuZXcgU3RyaW5nKCcnKWApXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqXG4gKiBfLmlzT2JqZWN0KHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc09iamVjdChfLm5vb3ApO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3QobnVsbCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgcmV0dXJuICEhdmFsdWUgJiYgKHR5cGUgPT0gJ29iamVjdCcgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0Z1bmN0aW9uO1xuIiwiLyoqXG4gKiBsb2Rhc2ggNC4wLjEgKEN1c3RvbSBCdWlsZCkgPGh0dHBzOi8vbG9kYXNoLmNvbS8+XG4gKiBCdWlsZDogYGxvZGFzaCBtb2R1bGFyaXplIGV4cG9ydHM9XCJucG1cIiAtbyAuL2BcbiAqIENvcHlyaWdodCAyMDEyLTIwMTYgVGhlIERvam8gRm91bmRhdGlvbiA8aHR0cDovL2Rvam9mb3VuZGF0aW9uLm9yZy8+XG4gKiBCYXNlZCBvbiBVbmRlcnNjb3JlLmpzIDEuOC4zIDxodHRwOi8vdW5kZXJzY29yZWpzLm9yZy9MSUNFTlNFPlxuICogQ29weXJpZ2h0IDIwMDktMjAxNiBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuICogQXZhaWxhYmxlIHVuZGVyIE1JVCBsaWNlbnNlIDxodHRwczovL2xvZGFzaC5jb20vbGljZW5zZT5cbiAqL1xuXG4vKiogYE9iamVjdCN0b1N0cmluZ2AgcmVzdWx0IHJlZmVyZW5jZXMuICovXG52YXIgc3RyaW5nVGFnID0gJ1tvYmplY3QgU3RyaW5nXSc7XG5cbi8qKiBVc2VkIGZvciBidWlsdC1pbiBtZXRob2QgcmVmZXJlbmNlcy4gKi9cbnZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XG5cbi8qKlxuICogVXNlZCB0byByZXNvbHZlIHRoZSBbYHRvU3RyaW5nVGFnYF0oaHR0cDovL2VjbWEtaW50ZXJuYXRpb25hbC5vcmcvZWNtYS0yNjIvNi4wLyNzZWMtb2JqZWN0LnByb3RvdHlwZS50b3N0cmluZylcbiAqIG9mIHZhbHVlcy5cbiAqL1xudmFyIG9iamVjdFRvU3RyaW5nID0gb2JqZWN0UHJvdG8udG9TdHJpbmc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgY2xhc3NpZmllZCBhcyBhbiBgQXJyYXlgIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQHR5cGUgRnVuY3Rpb25cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGNvcnJlY3RseSBjbGFzc2lmaWVkLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNBcnJheShkb2N1bWVudC5ib2R5LmNoaWxkcmVuKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5KCdhYmMnKTtcbiAqIC8vID0+IGZhbHNlXG4gKlxuICogXy5pc0FycmF5KF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICovXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYFN0cmluZ2AgcHJpbWl0aXZlIG9yIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc1N0cmluZygnYWJjJyk7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogXy5pc1N0cmluZygxKTtcbiAqIC8vID0+IGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3RyaW5nKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycgfHxcbiAgICAoIWlzQXJyYXkodmFsdWUpICYmIGlzT2JqZWN0TGlrZSh2YWx1ZSkgJiYgb2JqZWN0VG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gc3RyaW5nVGFnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1N0cmluZztcbiIsIi8qKlxuICogbG9kYXNoIDQuMC4wIChDdXN0b20gQnVpbGQpIDxodHRwczovL2xvZGFzaC5jb20vPlxuICogQnVpbGQ6IGBsb2Rhc2ggbW9kdWxhcml6ZSBleHBvcnRzPVwibnBtXCIgLW8gLi9gXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE2IFRoZSBEb2pvIEZvdW5kYXRpb24gPGh0dHA6Ly9kb2pvZm91bmRhdGlvbi5vcmcvPlxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjguMyA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cbiAqIENvcHlyaWdodCAyMDA5LTIwMTYgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbiAqIEF2YWlsYWJsZSB1bmRlciBNSVQgbGljZW5zZSA8aHR0cHM6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XG4gKi9cbnZhciB0b1N0cmluZyA9IHJlcXVpcmUoJ2xvZGFzaC50b3N0cmluZycpO1xuXG4vKiogVXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgSURzLiAqL1xudmFyIGlkQ291bnRlciA9IDA7XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgdW5pcXVlIElELiBJZiBgcHJlZml4YCBpcyBnaXZlbiB0aGUgSUQgaXMgYXBwZW5kZWQgdG8gaXQuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBVdGlsXG4gKiBAcGFyYW0ge3N0cmluZ30gW3ByZWZpeF0gVGhlIHZhbHVlIHRvIHByZWZpeCB0aGUgSUQgd2l0aC5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHVuaXF1ZSBJRC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy51bmlxdWVJZCgnY29udGFjdF8nKTtcbiAqIC8vID0+ICdjb250YWN0XzEwNCdcbiAqXG4gKiBfLnVuaXF1ZUlkKCk7XG4gKiAvLyA9PiAnMTA1J1xuICovXG5mdW5jdGlvbiB1bmlxdWVJZChwcmVmaXgpIHtcbiAgdmFyIGlkID0gKytpZENvdW50ZXI7XG4gIHJldHVybiB0b1N0cmluZyhwcmVmaXgpICsgaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdW5pcXVlSWQ7XG4iLCIvKipcbiAqIGxvZGFzaCA0LjEuMiAoQ3VzdG9tIEJ1aWxkKSA8aHR0cHM6Ly9sb2Rhc2guY29tLz5cbiAqIEJ1aWxkOiBgbG9kYXNoIG1vZHVsYXJpemUgZXhwb3J0cz1cIm5wbVwiIC1vIC4vYFxuICogQ29weXJpZ2h0IDIwMTItMjAxNiBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cbiAqIEJhc2VkIG9uIFVuZGVyc2NvcmUuanMgMS44LjMgPGh0dHA6Ly91bmRlcnNjb3JlanMub3JnL0xJQ0VOU0U+XG4gKiBDb3B5cmlnaHQgMjAwOS0yMDE2IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHBzOi8vbG9kYXNoLmNvbS9saWNlbnNlPlxuICovXG5cbi8qKiBVc2VkIGFzIHJlZmVyZW5jZXMgZm9yIHZhcmlvdXMgYE51bWJlcmAgY29uc3RhbnRzLiAqL1xudmFyIElORklOSVRZID0gMSAvIDA7XG5cbi8qKiBgT2JqZWN0I3RvU3RyaW5nYCByZXN1bHQgcmVmZXJlbmNlcy4gKi9cbnZhciBzeW1ib2xUYWcgPSAnW29iamVjdCBTeW1ib2xdJztcblxuLyoqIFVzZWQgdG8gZGV0ZXJtaW5lIGlmIHZhbHVlcyBhcmUgb2YgdGhlIGxhbmd1YWdlIHR5cGUgYE9iamVjdGAuICovXG52YXIgb2JqZWN0VHlwZXMgPSB7XG4gICdmdW5jdGlvbic6IHRydWUsXG4gICdvYmplY3QnOiB0cnVlXG59O1xuXG4vKiogRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGV4cG9ydHNgLiAqL1xudmFyIGZyZWVFeHBvcnRzID0gKG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlKVxuICA/IGV4cG9ydHNcbiAgOiB1bmRlZmluZWQ7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYC4gKi9cbnZhciBmcmVlTW9kdWxlID0gKG9iamVjdFR5cGVzW3R5cGVvZiBtb2R1bGVdICYmIG1vZHVsZSAmJiAhbW9kdWxlLm5vZGVUeXBlKVxuICA/IG1vZHVsZVxuICA6IHVuZGVmaW5lZDtcblxuLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBnbG9iYWxgIGZyb20gTm9kZS5qcy4gKi9cbnZhciBmcmVlR2xvYmFsID0gY2hlY2tHbG9iYWwoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSAmJiB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbCk7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgc2VsZmAuICovXG52YXIgZnJlZVNlbGYgPSBjaGVja0dsb2JhbChvYmplY3RUeXBlc1t0eXBlb2Ygc2VsZl0gJiYgc2VsZik7XG5cbi8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgd2luZG93YC4gKi9cbnZhciBmcmVlV2luZG93ID0gY2hlY2tHbG9iYWwob2JqZWN0VHlwZXNbdHlwZW9mIHdpbmRvd10gJiYgd2luZG93KTtcblxuLyoqIERldGVjdCBgdGhpc2AgYXMgdGhlIGdsb2JhbCBvYmplY3QuICovXG52YXIgdGhpc0dsb2JhbCA9IGNoZWNrR2xvYmFsKG9iamVjdFR5cGVzW3R5cGVvZiB0aGlzXSAmJiB0aGlzKTtcblxuLyoqXG4gKiBVc2VkIGFzIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWwgb2JqZWN0LlxuICpcbiAqIFRoZSBgdGhpc2AgdmFsdWUgaXMgdXNlZCBpZiBpdCdzIHRoZSBnbG9iYWwgb2JqZWN0IHRvIGF2b2lkIEdyZWFzZW1vbmtleSdzXG4gKiByZXN0cmljdGVkIGB3aW5kb3dgIG9iamVjdCwgb3RoZXJ3aXNlIHRoZSBgd2luZG93YCBvYmplY3QgaXMgdXNlZC5cbiAqL1xudmFyIHJvb3QgPSBmcmVlR2xvYmFsIHx8XG4gICgoZnJlZVdpbmRvdyAhPT0gKHRoaXNHbG9iYWwgJiYgdGhpc0dsb2JhbC53aW5kb3cpKSAmJiBmcmVlV2luZG93KSB8fFxuICAgIGZyZWVTZWxmIHx8IHRoaXNHbG9iYWwgfHwgRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIGdsb2JhbCBvYmplY3QuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge251bGx8T2JqZWN0fSBSZXR1cm5zIGB2YWx1ZWAgaWYgaXQncyBhIGdsb2JhbCBvYmplY3QsIGVsc2UgYG51bGxgLlxuICovXG5mdW5jdGlvbiBjaGVja0dsb2JhbCh2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHZhbHVlLk9iamVjdCA9PT0gT2JqZWN0KSA/IHZhbHVlIDogbnVsbDtcbn1cblxuLyoqIFVzZWQgZm9yIGJ1aWx0LWluIG1ldGhvZCByZWZlcmVuY2VzLiAqL1xudmFyIG9iamVjdFByb3RvID0gT2JqZWN0LnByb3RvdHlwZTtcblxuLyoqXG4gKiBVc2VkIHRvIHJlc29sdmUgdGhlIFtgdG9TdHJpbmdUYWdgXShodHRwOi8vZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9lY21hLTI2Mi82LjAvI3NlYy1vYmplY3QucHJvdG90eXBlLnRvc3RyaW5nKVxuICogb2YgdmFsdWVzLlxuICovXG52YXIgb2JqZWN0VG9TdHJpbmcgPSBvYmplY3RQcm90by50b1N0cmluZztcblxuLyoqIEJ1aWx0LWluIHZhbHVlIHJlZmVyZW5jZXMuICovXG52YXIgU3ltYm9sID0gcm9vdC5TeW1ib2w7XG5cbi8qKiBVc2VkIHRvIGNvbnZlcnQgc3ltYm9scyB0byBwcmltaXRpdmVzIGFuZCBzdHJpbmdzLiAqL1xudmFyIHN5bWJvbFByb3RvID0gU3ltYm9sID8gU3ltYm9sLnByb3RvdHlwZSA6IHVuZGVmaW5lZCxcbiAgICBzeW1ib2xUb1N0cmluZyA9IHN5bWJvbFByb3RvID8gc3ltYm9sUHJvdG8udG9TdHJpbmcgOiB1bmRlZmluZWQ7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgb2JqZWN0LWxpa2UuIEEgdmFsdWUgaXMgb2JqZWN0LWxpa2UgaWYgaXQncyBub3QgYG51bGxgXG4gKiBhbmQgaGFzIGEgYHR5cGVvZmAgcmVzdWx0IG9mIFwib2JqZWN0XCIuXG4gKlxuICogQHN0YXRpY1xuICogQG1lbWJlck9mIF9cbiAqIEBjYXRlZ29yeSBMYW5nXG4gKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIG9iamVjdC1saWtlLCBlbHNlIGBmYWxzZWAuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKHt9KTtcbiAqIC8vID0+IHRydWVcbiAqXG4gKiBfLmlzT2JqZWN0TGlrZShbMSwgMiwgM10pO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKF8ubm9vcCk7XG4gKiAvLyA9PiBmYWxzZVxuICpcbiAqIF8uaXNPYmplY3RMaWtlKG51bGwpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNPYmplY3RMaWtlKHZhbHVlKSB7XG4gIHJldHVybiAhIXZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0Jztcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBjbGFzc2lmaWVkIGFzIGEgYFN5bWJvbGAgcHJpbWl0aXZlIG9yIG9iamVjdC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgY29ycmVjdGx5IGNsYXNzaWZpZWQsIGVsc2UgYGZhbHNlYC5cbiAqIEBleGFtcGxlXG4gKlxuICogXy5pc1N5bWJvbChTeW1ib2wuaXRlcmF0b3IpO1xuICogLy8gPT4gdHJ1ZVxuICpcbiAqIF8uaXNTeW1ib2woJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTeW1ib2wodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnc3ltYm9sJyB8fFxuICAgIChpc09iamVjdExpa2UodmFsdWUpICYmIG9iamVjdFRvU3RyaW5nLmNhbGwodmFsdWUpID09IHN5bWJvbFRhZyk7XG59XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIHN0cmluZyBpZiBpdCdzIG5vdCBvbmUuIEFuIGVtcHR5IHN0cmluZyBpcyByZXR1cm5lZFxuICogZm9yIGBudWxsYCBhbmQgYHVuZGVmaW5lZGAgdmFsdWVzLiBUaGUgc2lnbiBvZiBgLTBgIGlzIHByZXNlcnZlZC5cbiAqXG4gKiBAc3RhdGljXG4gKiBAbWVtYmVyT2YgX1xuICogQGNhdGVnb3J5IExhbmdcbiAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHByb2Nlc3MuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzdHJpbmcuXG4gKiBAZXhhbXBsZVxuICpcbiAqIF8udG9TdHJpbmcobnVsbCk7XG4gKiAvLyA9PiAnJ1xuICpcbiAqIF8udG9TdHJpbmcoLTApO1xuICogLy8gPT4gJy0wJ1xuICpcbiAqIF8udG9TdHJpbmcoWzEsIDIsIDNdKTtcbiAqIC8vID0+ICcxLDIsMydcbiAqL1xuZnVuY3Rpb24gdG9TdHJpbmcodmFsdWUpIHtcbiAgLy8gRXhpdCBlYXJseSBmb3Igc3RyaW5ncyB0byBhdm9pZCBhIHBlcmZvcm1hbmNlIGhpdCBpbiBzb21lIGVudmlyb25tZW50cy5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHJldHVybiAnJztcbiAgfVxuICBpZiAoaXNTeW1ib2wodmFsdWUpKSB7XG4gICAgcmV0dXJuIHN5bWJvbFRvU3RyaW5nID8gc3ltYm9sVG9TdHJpbmcuY2FsbCh2YWx1ZSkgOiAnJztcbiAgfVxuICB2YXIgcmVzdWx0ID0gKHZhbHVlICsgJycpO1xuICByZXR1cm4gKHJlc3VsdCA9PSAnMCcgJiYgKDEgLyB2YWx1ZSkgPT0gLUlORklOSVRZKSA/ICctMCcgOiByZXN1bHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9TdHJpbmc7XG4iLCIvKiBqc2hpbnQgYnJvd3NlcjogdHJ1ZSAqL1xuXG4oZnVuY3Rpb24gKCkge1xuXG4vLyBUaGUgcHJvcGVydGllcyB0aGF0IHdlIGNvcHkgaW50byBhIG1pcnJvcmVkIGRpdi5cbi8vIE5vdGUgdGhhdCBzb21lIGJyb3dzZXJzLCBzdWNoIGFzIEZpcmVmb3gsXG4vLyBkbyBub3QgY29uY2F0ZW5hdGUgcHJvcGVydGllcywgaS5lLiBwYWRkaW5nLXRvcCwgYm90dG9tIGV0Yy4gLT4gcGFkZGluZyxcbi8vIHNvIHdlIGhhdmUgdG8gZG8gZXZlcnkgc2luZ2xlIHByb3BlcnR5IHNwZWNpZmljYWxseS5cbnZhciBwcm9wZXJ0aWVzID0gW1xuICAnZGlyZWN0aW9uJywgIC8vIFJUTCBzdXBwb3J0XG4gICdib3hTaXppbmcnLFxuICAnd2lkdGgnLCAgLy8gb24gQ2hyb21lIGFuZCBJRSwgZXhjbHVkZSB0aGUgc2Nyb2xsYmFyLCBzbyB0aGUgbWlycm9yIGRpdiB3cmFwcyBleGFjdGx5IGFzIHRoZSB0ZXh0YXJlYSBkb2VzXG4gICdoZWlnaHQnLFxuICAnb3ZlcmZsb3dYJyxcbiAgJ292ZXJmbG93WScsICAvLyBjb3B5IHRoZSBzY3JvbGxiYXIgZm9yIElFXG5cbiAgJ2JvcmRlclRvcFdpZHRoJyxcbiAgJ2JvcmRlclJpZ2h0V2lkdGgnLFxuICAnYm9yZGVyQm90dG9tV2lkdGgnLFxuICAnYm9yZGVyTGVmdFdpZHRoJyxcbiAgJ2JvcmRlclN0eWxlJyxcblxuICAncGFkZGluZ1RvcCcsXG4gICdwYWRkaW5nUmlnaHQnLFxuICAncGFkZGluZ0JvdHRvbScsXG4gICdwYWRkaW5nTGVmdCcsXG5cbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQ1NTL2ZvbnRcbiAgJ2ZvbnRTdHlsZScsXG4gICdmb250VmFyaWFudCcsXG4gICdmb250V2VpZ2h0JyxcbiAgJ2ZvbnRTdHJldGNoJyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRTaXplQWRqdXN0JyxcbiAgJ2xpbmVIZWlnaHQnLFxuICAnZm9udEZhbWlseScsXG5cbiAgJ3RleHRBbGlnbicsXG4gICd0ZXh0VHJhbnNmb3JtJyxcbiAgJ3RleHRJbmRlbnQnLFxuICAndGV4dERlY29yYXRpb24nLCAgLy8gbWlnaHQgbm90IG1ha2UgYSBkaWZmZXJlbmNlLCBidXQgYmV0dGVyIGJlIHNhZmVcblxuICAnbGV0dGVyU3BhY2luZycsXG4gICd3b3JkU3BhY2luZycsXG5cbiAgJ3RhYlNpemUnLFxuICAnTW96VGFiU2l6ZSdcblxuXTtcblxudmFyIGlzQnJvd3NlciA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyk7XG52YXIgaXNGaXJlZm94ID0gKGlzQnJvd3NlciAmJiB3aW5kb3cubW96SW5uZXJTY3JlZW5YICE9IG51bGwpO1xuXG5mdW5jdGlvbiBnZXRDYXJldENvb3JkaW5hdGVzKGVsZW1lbnQsIHBvc2l0aW9uLCBvcHRpb25zKSB7XG4gIGlmKCFpc0Jyb3dzZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RleHRhcmVhLWNhcmV0LXBvc2l0aW9uI2dldENhcmV0Q29vcmRpbmF0ZXMgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGluIGEgYnJvd3NlcicpO1xuICB9XG5cbiAgdmFyIGRlYnVnID0gb3B0aW9ucyAmJiBvcHRpb25zLmRlYnVnIHx8IGZhbHNlO1xuICBpZiAoZGVidWcpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjaW5wdXQtdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24tbWlycm9yLWRpdicpO1xuICAgIGlmICggZWwgKSB7IGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpOyB9XG4gIH1cblxuICAvLyBtaXJyb3JlZCBkaXZcbiAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBkaXYuaWQgPSAnaW5wdXQtdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24tbWlycm9yLWRpdic7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcblxuICB2YXIgc3R5bGUgPSBkaXYuc3R5bGU7XG4gIHZhciBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlPyBnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpIDogZWxlbWVudC5jdXJyZW50U3R5bGU7ICAvLyBjdXJyZW50U3R5bGUgZm9yIElFIDwgOVxuXG4gIC8vIGRlZmF1bHQgdGV4dGFyZWEgc3R5bGVzXG4gIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuICBpZiAoZWxlbWVudC5ub2RlTmFtZSAhPT0gJ0lOUFVUJylcbiAgICBzdHlsZS53b3JkV3JhcCA9ICdicmVhay13b3JkJzsgIC8vIG9ubHkgZm9yIHRleHRhcmVhLXNcblxuICAvLyBwb3NpdGlvbiBvZmYtc2NyZWVuXG4gIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJzsgIC8vIHJlcXVpcmVkIHRvIHJldHVybiBjb29yZGluYXRlcyBwcm9wZXJseVxuICBpZiAoIWRlYnVnKVxuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJzsgIC8vIG5vdCAnZGlzcGxheTogbm9uZScgYmVjYXVzZSB3ZSB3YW50IHJlbmRlcmluZ1xuXG4gIC8vIHRyYW5zZmVyIHRoZSBlbGVtZW50J3MgcHJvcGVydGllcyB0byB0aGUgZGl2XG4gIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xuICAgIHN0eWxlW3Byb3BdID0gY29tcHV0ZWRbcHJvcF07XG4gIH0pO1xuXG4gIGlmIChpc0ZpcmVmb3gpIHtcbiAgICAvLyBGaXJlZm94IGxpZXMgYWJvdXQgdGhlIG92ZXJmbG93IHByb3BlcnR5IGZvciB0ZXh0YXJlYXM6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTk4NDI3NVxuICAgIGlmIChlbGVtZW50LnNjcm9sbEhlaWdodCA+IHBhcnNlSW50KGNvbXB1dGVkLmhlaWdodCkpXG4gICAgICBzdHlsZS5vdmVyZmxvd1kgPSAnc2Nyb2xsJztcbiAgfSBlbHNlIHtcbiAgICBzdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nOyAgLy8gZm9yIENocm9tZSB0byBub3QgcmVuZGVyIGEgc2Nyb2xsYmFyOyBJRSBrZWVwcyBvdmVyZmxvd1kgPSAnc2Nyb2xsJ1xuICB9XG5cbiAgZGl2LnRleHRDb250ZW50ID0gZWxlbWVudC52YWx1ZS5zdWJzdHJpbmcoMCwgcG9zaXRpb24pO1xuICAvLyB0aGUgc2Vjb25kIHNwZWNpYWwgaGFuZGxpbmcgZm9yIGlucHV0IHR5cGU9XCJ0ZXh0XCIgdnMgdGV4dGFyZWE6IHNwYWNlcyBuZWVkIHRvIGJlIHJlcGxhY2VkIHdpdGggbm9uLWJyZWFraW5nIHNwYWNlcyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEzNDAyMDM1LzEyNjkwMzdcbiAgaWYgKGVsZW1lbnQubm9kZU5hbWUgPT09ICdJTlBVVCcpXG4gICAgZGl2LnRleHRDb250ZW50ID0gZGl2LnRleHRDb250ZW50LnJlcGxhY2UoL1xccy9nLCAnXFx1MDBhMCcpO1xuXG4gIHZhciBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAvLyBXcmFwcGluZyBtdXN0IGJlIHJlcGxpY2F0ZWQgKmV4YWN0bHkqLCBpbmNsdWRpbmcgd2hlbiBhIGxvbmcgd29yZCBnZXRzXG4gIC8vIG9udG8gdGhlIG5leHQgbGluZSwgd2l0aCB3aGl0ZXNwYWNlIGF0IHRoZSBlbmQgb2YgdGhlIGxpbmUgYmVmb3JlICgjNykuXG4gIC8vIFRoZSAgKm9ubHkqIHJlbGlhYmxlIHdheSB0byBkbyB0aGF0IGlzIHRvIGNvcHkgdGhlICplbnRpcmUqIHJlc3Qgb2YgdGhlXG4gIC8vIHRleHRhcmVhJ3MgY29udGVudCBpbnRvIHRoZSA8c3Bhbj4gY3JlYXRlZCBhdCB0aGUgY2FyZXQgcG9zaXRpb24uXG4gIC8vIGZvciBpbnB1dHMsIGp1c3QgJy4nIHdvdWxkIGJlIGVub3VnaCwgYnV0IHdoeSBib3RoZXI/XG4gIHNwYW4udGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZyhwb3NpdGlvbikgfHwgJy4nOyAgLy8gfHwgYmVjYXVzZSBhIGNvbXBsZXRlbHkgZW1wdHkgZmF1eCBzcGFuIGRvZXNuJ3QgcmVuZGVyIGF0IGFsbFxuICBkaXYuYXBwZW5kQ2hpbGQoc3Bhbik7XG5cbiAgdmFyIGNvb3JkaW5hdGVzID0ge1xuICAgIHRvcDogc3Bhbi5vZmZzZXRUb3AgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyVG9wV2lkdGgnXSksXG4gICAgbGVmdDogc3Bhbi5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKVxuICB9O1xuXG4gIGlmIChkZWJ1Zykge1xuICAgIHNwYW4uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyNhYWEnO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGl2KTtcbiAgfVxuXG4gIHJldHVybiBjb29yZGluYXRlcztcbn1cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzICE9ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcbn0gZWxzZSBpZihpc0Jyb3dzZXIpe1xuICB3aW5kb3cuZ2V0Q2FyZXRDb29yZGluYXRlcyA9IGdldENhcmV0Q29vcmRpbmF0ZXM7XG59XG5cbn0oKSk7XG4iLCJpbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnZXZlbnRzJztcblxuY29uc3QgQ0FMTEJBQ0tfTUVUSE9EUyA9IFsnaGFuZGxlUXVlcnlSZXN1bHQnXTtcblxuLyoqXG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqL1xuY2xhc3MgQ29tcGxldGVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmF0ZWdpZXMgPSBbXTtcblxuICAgIC8vIEJpbmQgY2FsbGJhY2sgbWV0aG9kc1xuICAgIENBTExCQUNLX01FVEhPRFMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIHRoaXNbbmFtZV0gPSB0aGlzW25hbWVdLmJpbmQodGhpcyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBzdHJhdGVneSB0byB0aGUgY29tcGxldGVyLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l9IHN0cmF0ZWd5XG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgcmVnaXN0ZXJTdHJhdGVneShzdHJhdGVneSkge1xuICAgIHRoaXMuc3RyYXRlZ2llcy5wdXNoKHN0cmF0ZWd5KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gSGVhZCB0byBpbnB1dCBjdXJzb3IuXG4gICAqIEBmaXJlcyBDb21wbGV0ZXIjaGl0XG4gICAqL1xuICBydW4odGV4dCkge1xuICAgIHZhciBxdWVyeSA9IHRoaXMuZXh0cmFjdFF1ZXJ5KHRleHQpO1xuICAgIGlmIChxdWVyeSkge1xuICAgICAgcXVlcnkuZXhlY3V0ZSh0aGlzLmhhbmRsZVF1ZXJ5UmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oYW5kbGVRdWVyeVJlc3VsdChbXSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgYSBxdWVyeSwgd2hpY2ggbWF0Y2hlcyB0byB0aGUgZ2l2ZW4gdGV4dC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBIZWFkIHRvIGlucHV0IGN1cnNvci5cbiAgICogQHJldHVybnMgez9RdWVyeX1cbiAgICovXG4gIGV4dHJhY3RRdWVyeSh0ZXh0KSB7XG4gICAgdmFyIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMuc3RyYXRlZ2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHF1ZXJ5ID0gdGhpcy5zdHJhdGVnaWVzW2ldLmJ1aWxkUXVlcnkodGV4dCk7XG4gICAgICBpZiAocXVlcnkpIHsgcmV0dXJuIHF1ZXJ5OyB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrZWQgYnkgUXVlcnkjZXhlY3V0ZS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTZWFyY2hSZXN1bHRbXX0gc2VhcmNoUmVzdWx0c1xuICAgKi9cbiAgaGFuZGxlUXVlcnlSZXN1bHQoc2VhcmNoUmVzdWx0cykge1xuICAgIC8qKlxuICAgICAqIEBldmVudCBDb21wbGV0ZXIjaGl0XG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJvcCB7U2VhcmNoUmVzdWx0W119IHNlYXJjaFJlc3VsdHNcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQoJ2hpdCcsIHsgc2VhcmNoUmVzdWx0cyB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDb21wbGV0ZXI7XG4iLCJpbXBvcnQgVGV4dGNvbXBsZXRlIGZyb20gJy4uL3RleHRjb21wbGV0ZSc7XG5cbmltcG9ydCBUZXh0YXJlYSBmcm9tICcuLi90ZXh0YXJlYSc7XG5cbnZhciB0ZXh0YXJlYSA9IG5ldyBUZXh0YXJlYShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGV4dGFyZWExJykpO1xudmFyIHRleHRjb21wbGV0ZSA9IG5ldyBUZXh0Y29tcGxldGUodGV4dGFyZWEpO1xudGV4dGNvbXBsZXRlLnJlZ2lzdGVyKFtcbiAge1xuICAgIG1hdGNoOiAvKF58XFxzKShcXHcrKSQvLFxuICAgIHNlYXJjaDogZnVuY3Rpb24gKHRlcm0sIGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhbdGVybS50b1VwcGVyQ2FzZSgpLCB0ZXJtLnRvTG93ZXJDYXNlKCldKTtcbiAgICB9LFxuICAgIHJlcGxhY2U6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIGAkMSR7dmFsdWV9IGA7XG4gICAgfVxuICB9XG5dKTtcbiIsImltcG9ydCB1bmlxdWVJZCBmcm9tICdsb2Rhc2gudW5pcXVlaWQnO1xuXG5leHBvcnQgY29uc3QgQ0xBU1NfTkFNRSA9ICd0ZXh0Y29tcGxldGUtaXRlbSc7XG5jb25zdCBBQ1RJVkVfQ0xBU1NfTkFNRSA9IGAke0NMQVNTX05BTUV9IGFjdGl2ZWA7XG5jb25zdCBDQUxMQkFDS19NRVRIT0RTID0gWydvbkNsaWNrJ107XG5cbi8qKlxuICogRW5jYXBzdWxhdGUgYW4gaXRlbSBvZiBkcm9wZG93bi5cbiAqL1xuY2xhc3MgRHJvcGRvd25JdGVtIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0fSBzZWFyY2hSZXN1bHRcbiAgICovXG4gIGNvbnN0cnVjdG9yKHNlYXJjaFJlc3VsdCkge1xuICAgIHRoaXMuc2VhcmNoUmVzdWx0ID0gc2VhcmNoUmVzdWx0O1xuICAgIHRoaXMuaWQgPSB1bmlxdWVJZCgnZHJvcGRvd24taXRlbS0nKTtcbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgQ0FMTEJBQ0tfTUVUSE9EUy5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgdGhpc1tuYW1lXSA9IHRoaXNbbmFtZV0uYmluZCh0aGlzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEByZXR1cm5zIHtIVE1MTElFbGVtZW50fVxuICAgKi9cbiAgZ2V0IGVsKCkge1xuICAgIGlmICghdGhpcy5fZWwpIHtcbiAgICAgIGxldCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gICAgICBsaS5pZCA9IHRoaXMuaWQ7XG4gICAgICBsaS5jbGFzc05hbWUgPSB0aGlzLmFjdGl2ZSA/IEFDVElWRV9DTEFTU19OQU1FIDogQ0xBU1NfTkFNRTtcbiAgICAgIGxldCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgYS5pbm5lckhUTUwgPSB0aGlzLnNlYXJjaFJlc3VsdC5yZW5kZXIoKTtcbiAgICAgIGxpLmFwcGVuZENoaWxkKGEpO1xuICAgICAgdGhpcy5fZWwgPSBsaTtcbiAgICAgIGxpLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25DbGljayk7XG4gICAgICBsaS5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5vbkNsaWNrKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2VsO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyeSB0byBmcmVlIHJlc291cmNlcyBhbmQgcGVyZm9ybSBvdGhlciBjbGVhbnVwIG9wZXJhdGlvbnMuXG4gICAqXG4gICAqIEBwdWJsaWNcbiAgICovXG4gIGZpbmFsaXplKCkge1xuICAgIHRoaXMuX2VsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25DbGljaywgZmFsc2UpO1xuICAgIHRoaXMuX2VsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLm9uQ2xpY2ssIGZhbHNlKTtcbiAgICAvLyBUaGlzIGVsZW1lbnQgaGFzIGFscmVhZHkgYmVlbiByZW1vdmVkIGJ5IGBEcm9wZG93biNjbGVhcmAuXG4gICAgdGhpcy5fZWwgPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrZWQgd2hlbiBpdCBpcyBhcHBlbmRlZCB0byBhIGRyb3Bkb3duLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7RHJvcGRvd259IGRyb3Bkb3duXG4gICAqIEBzZWUgRHJvcGRvd24jYXBwZW5kXG4gICAqL1xuICBhcHBlbmRlZChkcm9wZG93bikge1xuICAgIHRoaXMuZHJvcGRvd24gPSBkcm9wZG93bjtcbiAgICB0aGlzLnNpYmxpbmdzID0gZHJvcGRvd24uaXRlbXM7XG4gICAgdGhpcy5pbmRleCA9IHRoaXMuc2libGluZ3MubGVuZ3RoIC0gMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHVibGljXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgYWN0aXZhdGUoKSB7XG4gICAgaWYgKCF0aGlzLmFjdGl2ZSkge1xuICAgICAgdGhpcy5hY3RpdmUgPSB0cnVlO1xuICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSBBQ1RJVkVfQ0xBU1NfTkFNRTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIGRlYWN0aXZhdGUoKSB7XG4gICAgaWYgKHRoaXMuYWN0aXZlKSB7XG4gICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgdGhpcy5lbC5jbGFzc05hbWUgPSBDTEFTU19OQU1FO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIG5leHQgc2libGluZy5cbiAgICpcbiAgICogQHB1YmxpY1xuICAgKiBAcmV0dXJucyB7RHJvcGRvd25JdGVtfVxuICAgKi9cbiAgZ2V0IG5leHQoKSB7XG4gICAgdmFyIG5leHRJbmRleCA9ICh0aGlzLmluZGV4ID09PSB0aGlzLnNpYmxpbmdzLmxlbmd0aCAtIDEgPyAwIDogdGhpcy5pbmRleCArIDEpO1xuICAgIHJldHVybiB0aGlzLnNpYmxpbmdzW25leHRJbmRleF07XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBwcmV2aW91cyBzaWJsaW5nLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEByZXR1cm5zIHtEcm9wZG93bkl0ZW19XG4gICAqL1xuICBnZXQgcHJldigpIHtcbiAgICB2YXIgcHJldkluZGV4ID0gKHRoaXMuaW5kZXggPT09IDAgPyB0aGlzLnNpYmxpbmdzLmxlbmd0aCA6IHRoaXMuaW5kZXgpIC0gMTtcbiAgICByZXR1cm4gdGhpcy5zaWJsaW5nc1twcmV2SW5kZXhdO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7TW91c2VFdmVudH0gZVxuICAgKi9cbiAgb25DbGljayhlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvLyBQcmV2ZW50IGJsdXIgZXZlbnRcbiAgICB0aGlzLmRyb3Bkb3duLnNlbGVjdCh0aGlzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEcm9wZG93bkl0ZW07XG4iLCJpbXBvcnQgRHJvcGRvd25JdGVtIGZyb20gJy4vZHJvcGRvd24taXRlbSc7XG5pbXBvcnQge2NyZWF0ZUZyYWdtZW50LCBjcmVhdGVDdXN0b21FdmVudH0gZnJvbSAnLi91dGlscyc7XG5cbmltcG9ydCBleHRlbmQgZnJvbSAnbG9kYXNoLmFzc2lnbmluJztcbmltcG9ydCB1bmlxdWVJZCBmcm9tICdsb2Rhc2gudW5pcXVlaWQnO1xuaW1wb3J0IGlzRnVuY3Rpb24gZnJvbSAnbG9kYXNoLmlzZnVuY3Rpb24nO1xuaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ2V2ZW50cyc7XG5cbmNvbnN0IERFRkFVTFRfQ0xBU1NfTkFNRSA9ICdkcm9wZG93bi1tZW51IHRleHRjb21wbGV0ZS1kcm9wZG93bic7XG5cbi8qKlxuICogQHR5cGVkZWYge09iamVjdH0gRHJvcGRvd25+T2Zmc2V0XG4gKiBAcHJvcCB7bnVtYmVyfSBbdG9wXVxuICogQHByb3Age251bWJlcn0gW2xlZnRdXG4gKiBAcHJvcCB7bnVtYmVyfSBbcmlnaHRdXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSBEcm9wZG93bn5PcHRpb25zXG4gKiBAcHJvcCB7c3RyaW5nfSBbY2xhc3NOYW1lXVxuICogQHByb3Age2Z1bmN0aW9ufHN0cmluZ30gW2Zvb3Rlcl1cbiAqIEBwcm9wIHtmdW5jdGlvbnxzdHJpbmd9IFtoZWFkZXJdXG4gKiBAcHJvcCB7bnVtYmVyfSBbbWF4Q291bnRdXG4gKiBAcHJvcCB7T2JqZWN0fSBbc3R5bGVdXG4gKi9cblxuLyoqXG4gKiBFbmNhcHN1bGF0ZSBhIGRyb3Bkb3duIHZpZXcuXG4gKlxuICogQHByb3Age2Jvb2xlYW59IHNob3duIC0gV2hldGhlciB0aGUgI2VsIGlzIHNob3duIG9yIG5vdC5cbiAqIEBwcm9wIHtEcm9wZG93bkl0ZW1bXX0gaXRlbXMgLSBUaGUgYXJyYXkgb2YgcmVuZGVyZWQgZHJvcGRvd24gaXRlbXMuXG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqL1xuY2xhc3MgRHJvcGRvd24gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAvKipcbiAgICogQHJldHVybnMge0hUTUxVTGlzdEVsZW1lbnR9XG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRWxlbWVudCgpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd1bCcpO1xuICAgIGVsLmlkID0gdW5pcXVlSWQoJ3RleHRjb21wbGV0ZS1kcm9wZG93bi0nKTtcbiAgICBleHRlbmQoZWwuc3R5bGUsIHtcbiAgICAgIGRpc3BsYXk6ICdub25lJyxcbiAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgICAgekluZGV4OiAxMDAwMCxcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsKTtcbiAgICByZXR1cm4gZWw7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtjbGFzc05hbWU9REVGQVVMVF9DTEFTU19OQU1FXSAtIFRoZSBjbGFzcyBhdHRyaWJ1dGUgb2YgdGhlIGVsLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufHN0cmluZ30gW2Zvb3Rlcl1cbiAgICogQHBhcmFtIHtmdW5jdGlvbnxzdHJpbmd9IFtoZWFkZXJdXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBbbWF4Q291bnQ9MTBdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbc3R5bGVdIC0gVGhlIHN0eWxlIG9mIHRoZSBlbC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHtjbGFzc05hbWU9REVGQVVMVF9DTEFTU19OQU1FLCBmb290ZXIsIGhlYWRlciwgbWF4Q291bnQ9MTAsIHN0eWxlfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zaG93biA9IGZhbHNlO1xuICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICB0aGlzLmZvb3RlciA9IGZvb3RlcjtcbiAgICB0aGlzLmhlYWRlciA9IGhlYWRlcjtcbiAgICB0aGlzLm1heENvdW50ID0gbWF4Q291bnQ7XG4gICAgdGhpcy5lbC5jbGFzc05hbWUgPSBjbGFzc05hbWU7XG4gICAgaWYgKHN0eWxlKSB7XG4gICAgICBleHRlbmQodGhpcy5lbC5zdHlsZSwgc3R5bGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7SFRNTFVMaXN0RWxlbWVudH0gdGhlIGRyb3Bkb3duIGVsZW1lbnQuXG4gICAqL1xuICBnZXQgZWwoKSB7XG4gICAgdGhpcy5fZWwgfHwgKHRoaXMuX2VsID0gRHJvcGRvd24uY3JlYXRlRWxlbWVudCgpKTtcbiAgICByZXR1cm4gdGhpcy5fZWw7XG4gIH1cblxuICAvKipcbiAgICogUmVuZGVyIHRoZSBnaXZlbiBkYXRhIGFzIGRyb3Bkb3duIGl0ZW1zLlxuICAgKlxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdFtdfSBzZWFyY2hSZXN1bHRzXG4gICAqIEBwYXJhbSB7RHJvcGRvd25+T2Zmc2V0fSBjdXJzb3JPZmZzZXRcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqIEBmaXJlcyBEcm9wZG93biNyZW5kZXJcbiAgICogQGZpcmVzIERyb3Bkb3duI3JlbmRlcmVkXG4gICAqL1xuICByZW5kZXIoc2VhcmNoUmVzdWx0cywgY3Vyc29yT2Zmc2V0KSB7XG4gICAgLyoqXG4gICAgICogQGV2ZW50IERyb3Bkb3duI3JlbmRlclxuICAgICAqIEB0eXBlIHtDdXN0b21FdmVudH1cbiAgICAgKiBAcHJvcCB7ZnVuY3Rpb259IHByZXZlbnREZWZhdWx0XG4gICAgICovXG4gICAgbGV0IHJlbmRlckV2ZW50ID0gY3JlYXRlQ3VzdG9tRXZlbnQoJ3JlbmRlcicsIHsgY2FuY2VsYWJsZTogdHJ1ZSB9KTtcbiAgICB0aGlzLmVtaXQoJ3JlbmRlcicsIHJlbmRlckV2ZW50KTtcbiAgICBpZiAocmVuZGVyRXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGxldCByYXdSZXN1bHRzID0gW10sIGRyb3Bkb3duSXRlbXMgPSBbXTtcbiAgICBzZWFyY2hSZXN1bHRzLmZvckVhY2goc2VhcmNoUmVzdWx0ID0+IHtcbiAgICAgIHJhd1Jlc3VsdHMucHVzaChzZWFyY2hSZXN1bHQuZGF0YSk7XG4gICAgICBpZiAoZHJvcGRvd25JdGVtcy5sZW5ndGggPCB0aGlzLm1heENvdW50KSB7XG4gICAgICAgIGRyb3Bkb3duSXRlbXMucHVzaChuZXcgRHJvcGRvd25JdGVtKHNlYXJjaFJlc3VsdCkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuY2xlYXIoKVxuICAgICAgICAucmVuZGVyRWRnZShyYXdSZXN1bHRzLCAnaGVhZGVyJylcbiAgICAgICAgLmFwcGVuZChkcm9wZG93bkl0ZW1zKVxuICAgICAgICAucmVuZGVyRWRnZShyYXdSZXN1bHRzLCAnZm9vdGVyJylcbiAgICAgICAgLnNldE9mZnNldChjdXJzb3JPZmZzZXQpXG4gICAgICAgIC5zaG93KCk7XG4gICAgLyoqXG4gICAgICogQGV2ZW50IERyb3Bkb3duI3JlbmRlcmVkXG4gICAgICogQHR5cGUge0N1c3RvbUV2ZW50fVxuICAgICAqL1xuICAgIHRoaXMuZW1pdCgncmVuZGVyZWQnLCBjcmVhdGVDdXN0b21FdmVudCgncmVuZGVyZWQnKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogSGlkZSB0aGUgZHJvcGRvd24gdGhlbiBzd2VlcCBvdXQgaXRlbXMuXG4gICAqXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgZGVhY3RpdmF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5oaWRlKCkuY2xlYXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0Ryb3Bkb3duSXRlbX0gZHJvcGRvd25JdGVtXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKiBAZmlyZXMgRHJvcGRvd24jc2VsZWN0XG4gICAqL1xuICBzZWxlY3QoZHJvcGRvd25JdGVtKSB7XG4gICAgbGV0IGRldGFpbCA9IHsgc2VhcmNoUmVzdWx0OiBkcm9wZG93bkl0ZW0uc2VhcmNoUmVzdWx0IH07XG4gICAgLyoqXG4gICAgICogQGV2ZW50IERyb3Bkb3duI3NlbGVjdFxuICAgICAqIEB0eXBlIHtDdXN0b21FdmVudH1cbiAgICAgKiBAcHJvcCB7ZnVuY3Rpb259IHByZXZlbnREZWZhdWx0XG4gICAgICogQHByb3Age29iamVjdH0gZGV0YWlsXG4gICAgICogQHByb3Age1NlYXJjaFJlc3VsdH0gZGV0YWlsLnNlYXJjaFJlc3VsdFxuICAgICAqL1xuICAgIGxldCBzZWxlY3RFdmVudCA9IGNyZWF0ZUN1c3RvbUV2ZW50KCdzZWxlY3QnLCB7IGNhbmNlbGFibGU6IHRydWUsIGRldGFpbDogZGV0YWlsIH0pO1xuICAgIHRoaXMuZW1pdCgnc2VsZWN0Jywgc2VsZWN0RXZlbnQpO1xuICAgIGlmIChzZWxlY3RFdmVudC5kZWZhdWx0UHJldmVudGVkKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGhpcy5kZWFjdGl2YXRlKCk7XG4gICAgLyoqXG4gICAgICogQGV2ZW50IERyb3Bkb3duI3NlbGVjdGVkXG4gICAgICogQHR5cGUge0N1c3RvbUV2ZW50fVxuICAgICAqIEBwcm9wIHtvYmplY3R9IGRldGFpbFxuICAgICAqIEBwcm9wIHtTZWFyY2hSZXN1bHR9IGRldGFpbC5zZWFyY2hSZXN1bHRcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQoJ3NlbGVjdGVkJywgY3JlYXRlQ3VzdG9tRXZlbnQoJ3NlbGVjdGVkJywge2RldGFpbH0pKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIHVwKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMubW92ZUFjdGl2ZUl0ZW0oJ3ByZXYnLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBkb3duKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMubW92ZUFjdGl2ZUl0ZW0oJ25leHQnLCBjYWxsYmFjayk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGFjdGl2ZSBpdGVtLlxuICAgKlxuICAgKiBAcmV0dXJucyB7RHJvcGRvd25JdGVtfHVuZGVmaW5lZH1cbiAgICovXG4gIGdldEFjdGl2ZUl0ZW0oKSB7XG4gICAgcmV0dXJuIHRoaXMuaXRlbXMuZmluZCgoaXRlbSkgPT4geyByZXR1cm4gaXRlbS5hY3RpdmU7IH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBpdGVtcyB0byBkcm9wZG93bi5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtEcm9wZG93bkl0ZW1bXX0gaXRlbXNcbiAgICogQHJldHVybnMge3RoaXN9O1xuICAgKi9cbiAgYXBwZW5kKGl0ZW1zKSB7XG4gICAgdmFyIGZyYWdtZW50ID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIGl0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIHRoaXMuaXRlbXMucHVzaChpdGVtKTtcbiAgICAgIGl0ZW0uYXBwZW5kZWQodGhpcyk7XG4gICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChpdGVtLmVsKTtcbiAgICB9KTtcbiAgICB0aGlzLmVsLmFwcGVuZENoaWxkKGZyYWdtZW50KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge0Ryb3Bkb3dufk9mZnNldH0gY3Vyc29yT2Zmc2V0XG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgc2V0T2Zmc2V0KGN1cnNvck9mZnNldCkge1xuICAgIFsndG9wJywgJ3JpZ2h0JywgJ2JvdHRvbScsICdsZWZ0J10uZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGlmIChjdXJzb3JPZmZzZXQuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgdGhpcy5lbC5zdHlsZVtuYW1lXSA9IGAke2N1cnNvck9mZnNldFtuYW1lXX1weGA7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2hvdyB0aGUgZWxlbWVudC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqIEBmaXJlcyBEcm9wZG93biNzaG93XG4gICAqIEBmaXJlcyBEcm9wZG93biNzaG93blxuICAgKi9cbiAgc2hvdygpIHtcbiAgICBpZiAoIXRoaXMuc2hvd24pIHtcbiAgICAgIC8qKlxuICAgICAgICogQGV2ZW50IERyb3Bkb3duI3Nob3dcbiAgICAgICAqIEB0eXBlIHtDdXN0b21FdmVudH1cbiAgICAgICAqIEBwcm9wIHtmdW5jdGlvbn0gcHJldmVudERlZmF1bHRcbiAgICAgICAqL1xuICAgICAgbGV0IHNob3dFdmVudCA9IGNyZWF0ZUN1c3RvbUV2ZW50KCdzaG93JywgeyBjYW5jZWxhYmxlOiB0cnVlIH0pO1xuICAgICAgdGhpcy5lbWl0KCdzaG93Jywgc2hvd0V2ZW50KTtcbiAgICAgIGlmIChzaG93RXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICB0aGlzLnNob3duID0gdHJ1ZTtcbiAgICAgIC8qKlxuICAgICAgICogQGV2ZW50IERyb3Bkb3duI3Nob3duXG4gICAgICAgKiBAdHlwZSB7Q3VzdG9tRXZlbnR9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuZW1pdCgnc2hvd24nLCBjcmVhdGVDdXN0b21FdmVudCgnc2hvd24nKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEhpZGUgdGhlIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKiBAZmlyZXMgRHJvcGRvd24jaGlkZVxuICAgKiBAZmlyZXMgRHJvcGRvd24jaGlkZGVuXG4gICAqL1xuICBoaWRlKCkge1xuICAgIGlmICh0aGlzLnNob3duKSB7XG4gICAgICAvKipcbiAgICAgICAqIEBldmVudCBEcm9wZG93biNoaWRlXG4gICAgICAgKiBAdHlwZSB7Q3VzdG9tRXZlbnR9XG4gICAgICAgKiBAcHJvcCB7ZnVuY3Rpb259IHByZXZlbnREZWZhdWx0XG4gICAgICAgKi9cbiAgICAgIGxldCBoaWRlRXZlbnQgPSBjcmVhdGVDdXN0b21FdmVudCgnaGlkZScsIHsgY2FuY2VsYWJsZTogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuZW1pdCgnaGlkZScsIGhpZGVFdmVudCk7XG4gICAgICBpZiAoaGlkZUV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG4gICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICB0aGlzLnNob3duID0gZmFsc2U7XG4gICAgICAvKipcbiAgICAgICAqIEBldmVudCBEcm9wZG93biNoaWRkZW5cbiAgICAgICAqIEB0eXBlIHtDdXN0b21FdmVudH1cbiAgICAgICAqL1xuICAgICAgdGhpcy5lbWl0KCdoaWRkZW4nLCBjcmVhdGVDdXN0b21FdmVudCgnaGlkZGVuJykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhciBzZWFyY2ggcmVzdWx0cy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICBjbGVhcigpIHtcbiAgICB0aGlzLmVsLmlubmVySFRNTCA9ICcnO1xuICAgIHRoaXMuaXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4geyBpdGVtLmZpbmFsaXplKCk7IH0pO1xuICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFwibmV4dFwiIG9yIFwicHJldlwiLlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICovXG4gIG1vdmVBY3RpdmVJdGVtKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuc2hvd24pIHtcbiAgICAgIGxldCBhY3RpdmVJdGVtID0gdGhpcy5nZXRBY3RpdmVJdGVtKCk7XG4gICAgICBsZXQgbmV4dEFjdGl2ZUl0ZW07XG4gICAgICBpZiAoYWN0aXZlSXRlbSkge1xuICAgICAgICBhY3RpdmVJdGVtLmRlYWN0aXZhdGUoKTtcbiAgICAgICAgbmV4dEFjdGl2ZUl0ZW0gPSBhY3RpdmVJdGVtW25hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV4dEFjdGl2ZUl0ZW0gPSBuYW1lID09PSAnbmV4dCcgPyB0aGlzLml0ZW1zWzBdIDogdGhpcy5pdGVtc1t0aGlzLml0ZW1zLmxlbmd0aCAtIDFdO1xuICAgICAgfVxuICAgICAgaWYgKG5leHRBY3RpdmVJdGVtKSB7XG4gICAgICAgIGNhbGxiYWNrKG5leHRBY3RpdmVJdGVtLmFjdGl2YXRlKCkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge29iamVjdFtdfSByYXdSZXN1bHRzIC0gV2hhdCBjYWxsYmFja2VkIGJ5IHNlYXJjaCBmdW5jdGlvbi5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSAnaGVhZGVyJyBvciAnZm9vdGVyJy5cbiAgICogQHJldHVybnMge3RoaXN9XG4gICAqL1xuICByZW5kZXJFZGdlKHJhd1Jlc3VsdHMsIHR5cGUpIHtcbiAgICB2YXIgc291cmNlID0gdGhpc1t0eXBlXTtcbiAgICBpZiAoc291cmNlKSB7XG4gICAgICBsZXQgY29udGVudCA9IGlzRnVuY3Rpb24oc291cmNlKSA/IHNvdXJjZShyYXdSZXN1bHRzKSA6IHNvdXJjZTtcbiAgICAgIGxldCBmcmFnbWVudCA9IGNyZWF0ZUZyYWdtZW50KGA8bGkgY2xhc3M9XCJ0ZXh0Y29tcGxldGUtJHt0eXBlfVwiPiR7Y29udGVudH08L2xpPmApO1xuICAgICAgdGhpcy5lbC5hcHBlbmRDaGlsZChmcmFnbWVudCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERyb3Bkb3duO1xuIiwiaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ2V2ZW50cyc7XG5cbmV4cG9ydCBjb25zdCBFTlRFUiA9IDA7XG5leHBvcnQgY29uc3QgVVAgPSAxO1xuZXhwb3J0IGNvbnN0IERPV04gPSAyO1xuXG4vKipcbiAqIEFic3RyYWN0IGNsYXNzIHJlcHJlc2VudGluZyBhIGVkaXRvciB0YXJnZXQuXG4gKlxuICogQGFic3RyYWN0XG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqL1xuY2xhc3MgRWRpdG9yIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgLyoqXG4gICAqIEBldmVudCBFZGl0b3IjbW92ZVxuICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgKiBAcHJvcCB7bnVtYmVyfSBjb2RlXG4gICAqIEBwcm9wIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG5cbiAgLyoqXG4gICAqIEBldmVudCBFZGl0b3IjY2hhbmdlXG4gICAqIEB0eXBlIHtvYmplY3R9XG4gICAqIEBwcm9wIHtzdHJpbmd9IGJlZm9yZUN1cnNvclxuICAgKi9cblxuICAvKipcbiAgICogSXQgaXMgY2FsbGVkIHdoZW4gYSBzZWFyY2ggcmVzdWx0IGlzIHNlbGVjdGVkIGJ5IGEgdXNlci5cbiAgICpcbiAgICogQHBhcmFtIHtTZWFyY2hSZXN1bHR9IF9zZWFyY2hSZXN1bHRcbiAgICovXG4gIGFwcGx5U2VhcmNoUmVzdWx0KF9zZWFyY2hSZXN1bHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgaW5wdXQgY3Vyc29yJ3MgYWJzb2x1dGUgY29vcmRpbmF0ZXMgZnJvbSB0aGUgd2luZG93J3MgbGVmdFxuICAgKiB0b3AgY29ybmVyLiBJdCBpcyBpbnRlbmRlZCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YiBjbGFzc2VzLlxuICAgKlxuICAgKiBAdHlwZSB7RHJvcGRvd25+T2Zmc2V0fVxuICAgKi9cbiAgZ2V0IGN1cnNvck9mZnNldCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGl0b3I7XG4iLCJpbXBvcnQgU2VhcmNoUmVzdWx0IGZyb20gJy4vc2VhcmNoLXJlc3VsdCc7XG5cbi8qKlxuICogRW5jYXBzdWxhdGUgbWF0Y2hpbmcgY29uZGl0aW9uIGJldHdlZW4gYSBTdHJhdGVneSBhbmQgY3VycmVudCBlZGl0b3IncyB2YWx1ZS5cbiAqL1xuY2xhc3MgUXVlcnkge1xuICAvKipcbiAgICogQHBhcmFtIHtTdHJhdGVneX0gc3RyYXRlZ3lcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRlcm1cbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gbWF0Y2hcbiAgICovXG4gIGNvbnN0cnVjdG9yKHN0cmF0ZWd5LCB0ZXJtLCBtYXRjaCkge1xuICAgIHRoaXMuc3RyYXRlZ3kgPSBzdHJhdGVneTtcbiAgICB0aGlzLnRlcm0gPSB0ZXJtO1xuICAgIHRoaXMubWF0Y2ggPSBtYXRjaDtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2Ugc2VhcmNoIHN0cmF0ZWd5IGFuZCBjYWxsYmFjayB0aGUgZ2l2ZW4gZnVuY3Rpb24uXG4gICAqXG4gICAqIEBwdWJsaWNcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG4gIGV4ZWN1dGUoY2FsbGJhY2spIHtcbiAgICB0aGlzLnN0cmF0ZWd5LnNlYXJjaChcbiAgICAgIHRoaXMudGVybSxcbiAgICAgIHJlc3VsdHMgPT4ge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHRzLm1hcChyZXN1bHQgPT4ge1xuICAgICAgICAgIHJldHVybiBuZXcgU2VhcmNoUmVzdWx0KHJlc3VsdCwgdGhpcy50ZXJtLCB0aGlzLnN0cmF0ZWd5KTtcbiAgICAgICAgfSkpO1xuICAgICAgfSxcbiAgICAgIHRoaXMubWF0Y2hcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFF1ZXJ5O1xuIiwiY2xhc3MgU2VhcmNoUmVzdWx0IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIC0gQW4gZWxlbWVudCBvZiBhcnJheSBjYWxsYmFja2VkIGJ5IHNlYXJjaCBmdW5jdGlvbi5cbiAgICogQHBhcmFtIHtzdHJpbmd9IHRlcm1cbiAgICogQHBhcmFtIHtTdHJhdGVneX0gc3RyYXRlZ3lcbiAgICovXG4gIGNvbnN0cnVjdG9yKGRhdGEsIHRlcm0sIHN0cmF0ZWd5KSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB0aGlzLnRlcm0gPSB0ZXJtO1xuICAgIHRoaXMuc3RyYXRlZ3kgPSBzdHJhdGVneTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gYmVmb3JlQ3Vyc29yXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBhZnRlckN1cnNvclxuICAgKiBAcmV0dXJucyB7c3RyaW5nW118dW5kZWZpbmVkfVxuICAgKi9cbiAgcmVwbGFjZShiZWZvcmVDdXJzb3IsIGFmdGVyQ3Vyc29yKSB7XG4gICAgdmFyIHJlcGxhY2VtZW50ID0gdGhpcy5zdHJhdGVneS5yZXBsYWNlKHRoaXMuZGF0YSk7XG4gICAgaWYgKHJlcGxhY2VtZW50ICE9IG51bGwpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlcGxhY2VtZW50KSkge1xuICAgICAgICBhZnRlckN1cnNvciA9IHJlcGxhY2VtZW50WzFdICsgYWZ0ZXJDdXJzb3I7XG4gICAgICAgIHJlcGxhY2VtZW50ID0gcmVwbGFjZW1lbnRbMF07XG4gICAgICB9XG4gICAgICByZXR1cm4gW2JlZm9yZUN1cnNvci5yZXBsYWNlKHRoaXMuc3RyYXRlZ3kubWF0Y2gsIHJlcGxhY2VtZW50KSwgYWZ0ZXJDdXJzb3JdO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgKi9cbiAgcmVuZGVyKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmF0ZWd5LnRlbXBsYXRlKHRoaXMuZGF0YSwgdGhpcy50ZXJtKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTZWFyY2hSZXN1bHQ7XG4iLCJpbXBvcnQgUXVlcnkgZnJvbSAnLi9xdWVyeSc7XG5cbmltcG9ydCBpc0Z1bmN0aW9uIGZyb20gJ2xvZGFzaC5pc2Z1bmN0aW9uJztcbmltcG9ydCBpc1N0cmluZyBmcm9tICdsb2Rhc2guaXNzdHJpbmcnO1xuXG5jb25zdCBERUZBVUxUX0lOREVYID0gMjtcblxuZnVuY3Rpb24gREVGQVVMVF9URU1QTEFURSh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWU7XG59XG5cbi8qKlxuICogUHJvcGVydGllcyBmb3IgYSBzdHJhdGVneS5cbiAqXG4gKiBAdHlwZWRlZiB7T2JqZWN0fSBTdHJhdGVneX5Qcm9wZXJ0aWVzXG4gKiBAcHJvcCB7cmVnZXhwfGZ1bmN0aW9ufSBtYXRjaCAtIElmIGl0IGlzIGEgZnVuY3Rpb24sIGl0IG11c3QgcmV0dXJuIGEgUmVnRXhwLlxuICogQHByb3Age2Z1bmN0aW9ufSBzZWFyY2hcbiAqIEBwcm9wIHtmdW5jdGlvbn0gcmVwbGFjZVxuICogQHByb3Age2Z1bmN0aW9ufSBbY29udGV4dF1cbiAqIEBwcm9wIHtmdW5jdGlvbn0gW3RlbXBsYXRlXVxuICogQHByb3Age2Jvb2xlYW59IFtjYWNoZV1cbiAqIEBwcm9wIHtudW1iZXJ9IFtpbmRleD0yXVxuICovXG5cbi8qKlxuICogRW5jYXBzdWxhdGUgYSBzaW5nbGUgc3RyYXRlZ3kuXG4gKlxuICogQHByb3Age1N0cmF0ZWd5flByb3BlcnRpZXN9IHByb3BzIC0gSXRzIHByb3BlcnRpZXMuXG4gKi9cbmNsYXNzIFN0cmF0ZWd5IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyYXRlZ3l+UHJvcGVydGllc30gcHJvcHNcbiAgICovXG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICAgIHRoaXMuY2FjaGUgPSBwcm9wcy5jYWNoZSA/IHt9IDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBCdWlsZCBhIFF1ZXJ5IG9iamVjdCBieSB0aGUgZ2l2ZW4gc3RyaW5nIGlmIHRoaXMgbWF0Y2hlcyB0byB0aGUgc3RyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIEhlYWQgdG8gaW5wdXQgY3Vyc29yLlxuICAgKiBAcmV0dXJucyB7P1F1ZXJ5fVxuICAgKi9cbiAgYnVpbGRRdWVyeSh0ZXh0KSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odGhpcy5wcm9wcy5jb250ZXh0KSkge1xuICAgICAgbGV0IGNvbnRleHQgPSB0aGlzLnByb3BzLmNvbnRleHQodGV4dCk7XG4gICAgICBpZiAoaXNTdHJpbmcoY29udGV4dCkpIHtcbiAgICAgICAgdGV4dCA9IGNvbnRleHQ7XG4gICAgICB9IGVsc2UgaWYgKCFjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbWF0Y2ggPSB0ZXh0Lm1hdGNoKHRoaXMuZ2V0TWF0Y2hSZWdleHAodGV4dCkpO1xuICAgIHJldHVybiBtYXRjaCA/IG5ldyBRdWVyeSh0aGlzLCBtYXRjaFt0aGlzLmluZGV4XSwgbWF0Y2gpIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGVybVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBtYXRjaFxuICAgKi9cbiAgc2VhcmNoKHRlcm0sIGNhbGxiYWNrLCBtYXRjaCkge1xuICAgIGlmICh0aGlzLmNhY2hlKSB7XG4gICAgICB0aGlzLnNlYXJjaFdpdGhDYWNoZSh0ZXJtLCBjYWxsYmFjaywgbWF0Y2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb3BzLnNlYXJjaCh0ZXJtLCBjYWxsYmFjaywgbWF0Y2gpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIEFuIGVsZW1lbnQgb2YgYXJyYXkgY2FsbGJhY2tlZCBieSBzZWFyY2ggZnVuY3Rpb24uXG4gICAqIEByZXR1cm5zIHtzdHJpbmdbXXxzdHJpbmd8bnVsbH1cbiAgICovXG4gIHJlcGxhY2UoZGF0YSkge1xuICAgIHJldHVybiB0aGlzLnByb3BzLnJlcGxhY2UoZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRlcm1cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtIHtzdHJpbmdbXX0gbWF0Y2hcbiAgICovXG4gIHNlYXJjaFdpdGhDYWNoZSh0ZXJtLCBjYWxsYmFjaywgbWF0Y2gpIHtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlW3Rlcm1dO1xuICAgIGlmIChjYWNoZSkge1xuICAgICAgY2FsbGJhY2soY2FjaGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnByb3BzLnNlYXJjaCh0ZXJtLCByZXN1bHRzID0+IHtcbiAgICAgICAgdGhpcy5jYWNoZVt0ZXJtXSA9IHJlc3VsdHM7XG4gICAgICAgIGNhbGxiYWNrKHJlc3VsdHMpO1xuICAgICAgfSwgbWF0Y2gpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJucyB7UmVnRXhwfVxuICAgKi9cbiAgZ2V0TWF0Y2hSZWdleHAodGV4dCkge1xuICAgIHJldHVybiBpc0Z1bmN0aW9uKHRoaXMubWF0Y2gpID8gdGhpcy5tYXRjaCh0ZXh0KSA6IHRoaXMubWF0Y2g7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge1JlZ0V4cHxGdW5jdGlvbn1cbiAgICovXG4gIGdldCBtYXRjaCgpIHtcbiAgICByZXR1cm4gdGhpcy5wcm9wcy5tYXRjaDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7TnVtYmVyfVxuICAgKi9cbiAgZ2V0IGluZGV4KCkge1xuICAgIHJldHVybiB0aGlzLnByb3BzLmluZGV4IHx8IERFRkFVTFRfSU5ERVg7XG4gIH1cblxuICAvKipcbiAgICogQHJldHVybnMge2Z1bmN0aW9ufVxuICAgKi9cbiAgZ2V0IHRlbXBsYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnByb3BzLnRlbXBsYXRlIHx8IERFRkFVTFRfVEVNUExBVEU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU3RyYXRlZ3k7XG4iLCJpbXBvcnQgRWRpdG9yLCB7RU5URVIsIFVQLCBET1dOfSBmcm9tICcuL2VkaXRvcic7XG5cbmNvbnN0IGdldENhcmV0Q29vcmRpbmF0ZXMgPSByZXF1aXJlKCd0ZXh0YXJlYS1jYXJldCcpO1xuXG5jb25zdCBDQUxMQkFDS19NRVRIT0RTID0gWydvbktleWRvd24nLCAnb25LZXl1cCddO1xuXG4vKipcbiAqIEVuY2Fwc3VsYXRlIHRoZSB0YXJnZXQgdGV4dGFyZWEgZWxlbWVudC5cbiAqXG4gKiBAZXh0ZW5kcyBFZGl0b3JcbiAqIEBwcm9wIHtIVE1MVGV4dEFyZWFFbGVtZW50fSBlbCAtIFdoZXJlIHRoZSB0ZXh0Y29tcGxldGUgd29ya3Mgb24uXG4gKi9cbmNsYXNzIFRleHRhcmVhIGV4dGVuZHMgRWRpdG9yIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7SFRNTFRleHRBcmVhRWxlbWVudH0gZWxcbiAgICovXG4gIGNvbnN0cnVjdG9yKGVsKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmVsID0gZWw7XG5cbiAgICAvLyBCaW5kIGNhbGxiYWNrIG1ldGhvZHNcbiAgICBDQUxMQkFDS19NRVRIT0RTLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICB0aGlzW25hbWVdID0gdGhpc1tuYW1lXS5iaW5kKHRoaXMpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5vbktleWRvd24pO1xuICAgIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLm9uS2V5dXApO1xuICB9XG5cbiAgLyoqXG4gICAqIEBvdmVycmlkZVxuICAgKiBAcGFyYW0ge1NlYXJjaFJlc3VsdH0gc2VhcmNoUmVzdWx0XG4gICAqL1xuICBhcHBseVNlYXJjaFJlc3VsdChzZWFyY2hSZXN1bHQpIHtcbiAgICB2YXIgcmVwbGFjZSA9IHNlYXJjaFJlc3VsdC5yZXBsYWNlKHRoaXMuYmVmb3JlQ3Vyc29yLCB0aGlzLmFmdGVyQ3Vyc29yKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyZXBsYWNlKSkge1xuICAgICAgdGhpcy5lbC52YWx1ZSA9IHJlcGxhY2VbMF0gKyByZXBsYWNlWzFdO1xuICAgICAgdGhpcy5lbC5zZWxlY3Rpb25TdGFydCA9IHRoaXMuZWwuc2VsZWN0aW9uRW5kID0gcmVwbGFjZVswXS5sZW5ndGg7XG4gICAgfVxuICAgIHRoaXMuZWwuZm9jdXMoKTsgLy8gQ2xpY2tpbmcgYSBkcm9wZG93biBpdGVtIHJlbW92ZXMgZm9jdXMgZnJvbSB0aGUgZWxlbWVudC5cbiAgfVxuXG4gIGdldCBjdXJzb3JPZmZzZXQoKSB7XG4gICAgdmFyIGVsT2Zmc2V0ID0gdGhpcy5nZXRFbE9mZnNldCgpO1xuICAgIHZhciBlbFNjcm9sbCA9IHRoaXMuZ2V0RWxTY3JvbGwoKTtcbiAgICB2YXIgY3Vyc29yUG9zaXRpb24gPSB0aGlzLmdldEN1cnNvclBvc2l0aW9uKCk7XG4gICAgdmFyIHRvcCA9IGVsT2Zmc2V0LnRvcCAtIGVsU2Nyb2xsLnRvcCArIGN1cnNvclBvc2l0aW9uLnRvcCArIHRoaXMuZ2V0RWxMaW5lSGVpZ2h0KCk7XG4gICAgdmFyIGxlZnQgPSBlbE9mZnNldC5sZWZ0IC0gZWxTY3JvbGwubGVmdCArIGN1cnNvclBvc2l0aW9uLmxlZnQ7XG4gICAgaWYgKHRoaXMuZWwuZGlyICE9PSAncnRsJykge1xuICAgICAgcmV0dXJuIHsgdG9wLCBsZWZ0IH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7IHRvcDogdG9wLCByaWdodDogZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIC0gbGVmdCB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc3RyaW5nIGZyb20gaGVhZCB0byBjdXJyZW50IGlucHV0IGN1cnNvciBwb3NpdGlvbi5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICovXG4gIGdldCBiZWZvcmVDdXJzb3IoKSB7XG4gICAgcmV0dXJuIHRoaXMuZWwudmFsdWUuc3Vic3RyaW5nKDAsIHRoaXMuZWwuc2VsZWN0aW9uRW5kKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgKi9cbiAgZ2V0IGFmdGVyQ3Vyc29yKCkge1xuICAgIHJldHVybiB0aGlzLmVsLnZhbHVlLnN1YnN0cmluZyh0aGlzLmVsLnNlbGVjdGlvbkVuZCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBjdXJyZW50IGNvb3JkaW5hdGVzIG9mIHRoZSBgI2VsYCByZWxhdGl2ZSB0byB0aGUgZG9jdW1lbnQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHt7dG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlcn19XG4gICAqL1xuICBnZXRFbE9mZnNldCgpIHtcbiAgICB2YXIgcmVjdCA9IHRoaXMuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdmFyIGRvY3VtZW50RWxlbWVudCA9IHRoaXMuZWwub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvcDogcmVjdC50b3AgLSBkb2N1bWVudEVsZW1lbnQuY2xpZW50VG9wLFxuICAgICAgbGVmdDogcmVjdC5sZWZ0IC0gZG9jdW1lbnRFbGVtZW50LmNsaWVudExlZnQsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7e3RvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXJ9fVxuICAgKi9cbiAgZ2V0RWxTY3JvbGwoKSB7XG4gICAgcmV0dXJuIHsgdG9wOiB0aGlzLmVsLnNjcm9sbFRvcCwgbGVmdDogdGhpcy5lbC5zY3JvbGxMZWZ0IH07XG4gIH1cblxuICAvKipcbiAgICogVGhlIGlucHV0IGN1cnNvcidzIHJlbGF0aXZlIGNvb3JkaW5hdGVzIGZyb20gdGhlIHRleHRhcmVhJ3MgbGVmdFxuICAgKiB0b3AgY29ybmVyLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7e3RvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXJ9fVxuICAgKi9cbiAgZ2V0Q3Vyc29yUG9zaXRpb24oKSB7XG4gICAgLy8gdGV4dGFyZWEtY2FyZXQgdGhyb3dzIGFuIGVycm9yIGlmIGB3aW5kb3dgIGlzIHVuZGVmaW5lZC5cbiAgICByZXR1cm4gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgICAgZ2V0Q2FyZXRDb29yZGluYXRlcyh0aGlzLmVsLCB0aGlzLmVsLnNlbGVjdGlvbkVuZCkgOiB7IHRvcDogMCwgbGVmdDogMCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAqL1xuICBnZXRFbExpbmVIZWlnaHQoKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gZG9jdW1lbnQuZGVmYXVsdFZpZXcuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsKTtcbiAgICB2YXIgbGluZUhlaWdodCA9IHBhcnNlSW50KGNvbXB1dGVkLmxpbmVIZWlnaHQsIDEwKTtcbiAgICByZXR1cm4gaXNOYU4obGluZUhlaWdodCkgPyBwYXJzZUludChjb21wdXRlZC5mb250U2l6ZSwgMTApIDogbGluZUhlaWdodDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAZmlyZXMgRWRpdG9yI21vdmVcbiAgICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBlXG4gICAqL1xuICBvbktleWRvd24oZSkge1xuICAgIHZhciBjb2RlID0gdGhpcy5nZXRDb2RlKGUpO1xuICAgIGlmIChjb2RlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmVtaXQoJ21vdmUnLCB7XG4gICAgICAgIGNvZGU6IGNvZGUsXG4gICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBmaXJlcyBFZGl0b3IjY2hhbmdlXG4gICAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZVxuICAgKi9cbiAgb25LZXl1cChlKSB7XG4gICAgaWYgKCF0aGlzLmlzTW92ZUtleUV2ZW50KGUpKSB7XG4gICAgICB0aGlzLmVtaXQoJ2NoYW5nZScsIHsgYmVmb3JlQ3Vyc29yOiB0aGlzLmJlZm9yZUN1cnNvciB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBlXG4gICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgKi9cbiAgaXNNb3ZlS2V5RXZlbnQoZSkge1xuICAgIHZhciBjb2RlID0gdGhpcy5nZXRDb2RlKGUpO1xuICAgIHJldHVybiBjb2RlICE9PSBFTlRFUiAmJiBjb2RlICE9PSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZVxuICAgKiBAcmV0dXJucyB7RU5URVJ8VVB8RE9XTnxudWxsfVxuICAgKi9cbiAgZ2V0Q29kZShlKSB7XG4gICAgcmV0dXJuIGUua2V5Q29kZSA9PT0gMTMgPyBFTlRFUlxuICAgICAgICAgOiBlLmtleUNvZGUgPT09IDM4ID8gVVBcbiAgICAgICAgIDogZS5rZXlDb2RlID09PSA0MCA/IERPV05cbiAgICAgICAgIDogZS5rZXlDb2RlID09PSA3OCAmJiBlLmN0cmxLZXkgPyBET1dOXG4gICAgICAgICA6IGUua2V5Q29kZSA9PT0gODAgJiYgZS5jdHJsS2V5ID8gVVBcbiAgICAgICAgIDogbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUZXh0YXJlYTtcbiIsImltcG9ydCBDb21wbGV0ZXIgZnJvbSAnLi9jb21wbGV0ZXInO1xuaW1wb3J0IERyb3Bkb3duIGZyb20gJy4vZHJvcGRvd24nO1xuaW1wb3J0IFN0cmF0ZWd5IGZyb20gJy4vc3RyYXRlZ3knO1xuaW1wb3J0IHtFTlRFUiwgVVAsIERPV059IGZyb20gJy4vZWRpdG9yJztcbmltcG9ydCB7bG9ja30gZnJvbSAnLi91dGlscyc7XG5cbmltcG9ydCBpc0Z1bmN0aW9uIGZyb20gJ2xvZGFzaC5pc2Z1bmN0aW9uJztcbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdldmVudHMnO1xuXG5jb25zdCBDQUxMQkFDS19NRVRIT0RTID0gW1xuICAnaGFuZGxlQ2hhbmdlJyxcbiAgJ2hhbmRsZUhpdCcsXG4gICdoYW5kbGVNb3ZlJyxcbiAgJ2hhbmRsZVNlbGVjdCcsXG5dO1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGEgdGV4dGNvbXBsZXRlLlxuICpcbiAqIEB0eXBlZGVmIHtPYmplY3R9IFRleHRjb21wbGV0ZX5PcHRpb25zXG4gKiBAcHJvcCB7RHJvcGRvd25+T3B0aW9uc30gZHJvcGRvd25cbiAqL1xuXG4vKipcbiAqIFRoZSBjb3JlIG9mIHRleHRjb21wbGV0ZS4gSXQgYWN0cyBhcyBhIG1lZGlhdG9yLlxuICpcbiAqIEBwcm9wIHtDb21wbGV0ZXJ9IGNvbXBsZXRlclxuICogQHByb3Age0Ryb3Bkb3dufSBkcm9wZG93blxuICogQHByb3Age0VkaXRvcn0gZWRpdG9yXG4gKiBAZXh0ZW5kcyBFdmVudEVtaXR0ZXJcbiAqIEB0dXRvcmlhbCBnZXR0aW5nLXN0YXJ0ZWRcbiAqL1xuY2xhc3MgVGV4dGNvbXBsZXRlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7RWRpdG9yfSBlZGl0b3IgLSBXaGVyZSB0aGUgdGV4dGNvbXBsZXRlIHdvcmtzIG9uLlxuICAgKiBAcGFyYW0ge1RleHRjb21wbGV0ZX5PcHRpb25zfSBvcHRpb25zXG4gICAqL1xuICBjb25zdHJ1Y3RvcihlZGl0b3IsIG9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLmNvbXBsZXRlciA9IG5ldyBDb21wbGV0ZXIoKTtcbiAgICB0aGlzLmRyb3Bkb3duID0gbmV3IERyb3Bkb3duKG9wdGlvbnMuZHJvcGRvd24gfHwge30pO1xuICAgIHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvLyBCaW5kIGNhbGxiYWNrIG1ldGhvZHNcbiAgICBDQUxMQkFDS19NRVRIT0RTLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICB0aGlzW25hbWVdID0gdGhpc1tuYW1lXS5iaW5kKHRoaXMpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5sb2NrYWJsZVRyaWdnZXIgPSBsb2NrKGZ1bmN0aW9uIChmcmVlLCB0ZXh0KSB7XG4gICAgICB0aGlzLmZyZWUgPSBmcmVlO1xuICAgICAgdGhpcy5jb21wbGV0ZXIucnVuKHRleHQpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zdGFydExpc3RlbmluZygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwdWJsaWNcbiAgICogQHBhcmFtIHtTdHJhdGVneX5Qcm9wZXJ0aWVzW119IHN0cmF0ZWd5UHJvcHNBcnJheVxuICAgKiBAcmV0dXJucyB7dGhpc31cbiAgICogQGV4YW1wbGVcbiAgICogdGV4dGNvbXBsZXRlLnJlZ2lzdGVyKFt7XG4gICAqICAgbWF0Y2g6IC8oXnxcXHMpKFxcdyspJC8sXG4gICAqICAgc2VhcmNoOiBmdW5jdGlvbiAodGVybSwgY2FsbGJhY2spIHtcbiAgICogICAgICQuYWpheCh7IC4uLiB9KVxuICAgKiAgICAgICAuZG9uZShjYWxsYmFjaylcbiAgICogICAgICAgLmZhaWwoW10pO1xuICAgKiAgIH0sXG4gICAqICAgcmVwbGFjZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAqICAgICByZXR1cm4gJyQxJyArIHZhbHVlICsgJyAnO1xuICAgKiAgIH1cbiAgICogfV0pO1xuICAgKi9cbiAgcmVnaXN0ZXIoc3RyYXRlZ3lQcm9wc0FycmF5KSB7XG4gICAgc3RyYXRlZ3lQcm9wc0FycmF5LmZvckVhY2goKHByb3BzKSA9PiB7XG4gICAgICB0aGlzLmNvbXBsZXRlci5yZWdpc3RlclN0cmF0ZWd5KG5ldyBTdHJhdGVneShwcm9wcykpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGF1dG9jb21wbGV0aW5nLlxuICAgKlxuICAgKiBAcHVibGljXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gSGVhZCB0byBpbnB1dCBjdXJzb3IuXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKiBAbGlzdGVucyBFZGl0b3IjY2hhbmdlXG4gICAqL1xuICB0cmlnZ2VyKHRleHQpIHtcbiAgICB0aGlzLmxvY2thYmxlVHJpZ2dlcih0ZXh0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBVbmxvY2sgdHJpZ2dlciBtZXRob2QuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHt0aGlzfVxuICAgKi9cbiAgdW5sb2NrKCkge1xuICAgIC8vIENhbGxpbmcgZnJlZSBmdW5jdGlvbiBtYXkgYXNzaWduIGEgbmV3IGZ1bmN0aW9uIHRvIGB0aGlzLmZyZWVgLlxuICAgIC8vIEl0IGRlcGVuZHMgb24gd2hldGhlciBleHRyYSBmdW5jdGlvbiBjYWxsIHdhcyBtYWRlIG9yIG5vdC5cbiAgICB2YXIgZnJlZSA9IHRoaXMuZnJlZTtcbiAgICB0aGlzLmZyZWUgPSBudWxsO1xuICAgIGlmIChpc0Z1bmN0aW9uKGZyZWUpKSB7IGZyZWUoKTsgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7U2VhcmNoUmVzdWx0W119IHNlYXJjaFJlc3VsdHNcbiAgICogQGxpc3RlbnMgQ29tcGxldGVyI2hpdFxuICAgKi9cbiAgaGFuZGxlSGl0KHtzZWFyY2hSZXN1bHRzfSkge1xuICAgIGlmIChzZWFyY2hSZXN1bHRzLmxlbmd0aCkge1xuICAgICAgdGhpcy5kcm9wZG93bi5yZW5kZXIoc2VhcmNoUmVzdWx0cywgdGhpcy5lZGl0b3IuY3Vyc29yT2Zmc2V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kcm9wZG93bi5kZWFjdGl2YXRlKCk7XG4gICAgfVxuICAgIHRoaXMudW5sb2NrKCk7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtFTlRFUnxVUHxET1dOfSBjb2RlXG4gICAqIEBwYXJhbSB7ZnVuY2lvbn0gY2FsbGJhY2tcbiAgICogQGxpc3RlbnMgRWRpdG9yI21vdmVcbiAgICovXG4gIGhhbmRsZU1vdmUoe2NvZGUsIGNhbGxiYWNrfSkge1xuICAgIHN3aXRjaCAoY29kZSkge1xuICAgIGNhc2UgRU5URVI6XG4gICAgICBsZXQgYWN0aXZlSXRlbSA9IHRoaXMuZHJvcGRvd24uZ2V0QWN0aXZlSXRlbSgpO1xuICAgICAgaWYgKGFjdGl2ZUl0ZW0pIHtcbiAgICAgICAgdGhpcy5kcm9wZG93bi5zZWxlY3QoYWN0aXZlSXRlbSk7XG4gICAgICAgIGNhbGxiYWNrKGFjdGl2ZUl0ZW0pO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSBVUDpcbiAgICAgIHRoaXMuZHJvcGRvd24udXAoY2FsbGJhY2spO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBET1dOOlxuICAgICAgdGhpcy5kcm9wZG93bi5kb3duKGNhbGxiYWNrKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge3N0cmluZ30gYmVmb3JlQ3Vyc29yXG4gICAqIEBsaXN0ZW5zIEVkaXRvciNjaGFuZ2VcbiAgICovXG4gIGhhbmRsZUNoYW5nZSh7YmVmb3JlQ3Vyc29yfSkge1xuICAgIHRoaXMudHJpZ2dlcihiZWZvcmVDdXJzb3IpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7RHJvcGRvd24jc2VsZWN0fSBzZWxlY3RFdmVudFxuICAgKiBAbGlzdGVucyBEcm9wZG93biNzZWxlY3RcbiAgICovXG4gIGhhbmRsZVNlbGVjdChzZWxlY3RFdmVudCkge1xuICAgIHRoaXMuZW1pdCgnc2VsZWN0Jywgc2VsZWN0RXZlbnQpO1xuICAgIGlmICghc2VsZWN0RXZlbnQuZGVmYXVsdFByZXZlbnRlZCkge1xuICAgICAgdGhpcy5lZGl0b3IuYXBwbHlTZWFyY2hSZXN1bHQoc2VsZWN0RXZlbnQuZGV0YWlsLnNlYXJjaFJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWVcbiAgICogQHJldHVybnMge2Z1bmN0aW9ufVxuICAgKi9cbiAgYnVpbGRIYW5kbGVyKGV2ZW50TmFtZSkge1xuICAgIHJldHVybiAoKSA9PiB7IHRoaXMuZW1pdChldmVudE5hbWUpOyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGFydExpc3RlbmluZygpIHtcbiAgICB0aGlzLmVkaXRvci5vbignbW92ZScsIHRoaXMuaGFuZGxlTW92ZSlcbiAgICAgICAgICAgICAgIC5vbignY2hhbmdlJywgdGhpcy5oYW5kbGVDaGFuZ2UpO1xuICAgIHRoaXMuZHJvcGRvd24ub24oJ3NlbGVjdCcsIHRoaXMuaGFuZGxlU2VsZWN0KTtcbiAgICBbJ3Nob3cnLCAnc2hvd24nLCAncmVuZGVyJywgJ3JlbmRlcmVkJywgJ3NlbGVjdGVkJywgJ2hpZGRlbicsICdoaWRlJ10uZm9yRWFjaChldmVudE5hbWUgPT4ge1xuICAgICAgdGhpcy5kcm9wZG93bi5vbihldmVudE5hbWUsIHRoaXMuYnVpbGRIYW5kbGVyKGV2ZW50TmFtZSkpO1xuICAgIH0pO1xuICAgIHRoaXMuY29tcGxldGVyLm9uKCdoaXQnLCB0aGlzLmhhbmRsZUhpdCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVGV4dGNvbXBsZXRlO1xuIiwiaW1wb3J0IGV4dGVuZCBmcm9tICdsb2Rhc2guYXNzaWduaW4nO1xuXG4vKipcbiAqIEV4Y2x1c2l2ZSBleGVjdXRpb24gY29udHJvbCB1dGlsaXR5LlxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gYmUgbG9ja2VkLiBJdCBpcyBleGVjdXRlZCB3aXRoIGFcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBuYW1lZCBgZnJlZWAgYXMgdGhlIGZpcnN0IGFyZ3VtZW50LiBPbmNlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgaXMgY2FsbGVkLCBhZGRpdGlvbmFsIGV4ZWN1dGlvbiBhcmUgaWdub3JlZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgIHVudGlsIHRoZSBmcmVlIGlzIGludm9rZWQuIFRoZW4gdGhlIGxhc3QgaWdub3JlZFxuICogICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWN1dGlvbiB3aWxsIGJlIHJlcGxheWVkIGltbWVkaWF0ZWx5LlxuICogQGV4YW1wbGVcbiAqIHZhciBsb2NrZWRGdW5jID0gbG9jayhmdW5jdGlvbiAoZnJlZSkge1xuICogICBzZXRUaW1lb3V0KGZ1bmN0aW9uIHsgZnJlZSgpOyB9LCAxMDAwKTsgLy8gSXQgd2lsbCBiZSBmcmVlIGluIDEgc2VjLlxuICogICBjb25zb2xlLmxvZygnSGVsbG8sIHdvcmxkJyk7XG4gKiB9KTtcbiAqIGxvY2tlZEZ1bmMoKTsgIC8vID0+ICdIZWxsbywgd29ybGQnXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyBub25lXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyBub25lXG4gKiAvLyAxIHNlYyBwYXN0IHRoZW5cbiAqIC8vID0+ICdIZWxsbywgd29ybGQnXG4gKiBsb2NrZWRGdW5jKCk7ICAvLyA9PiAnSGVsbG8sIHdvcmxkJ1xuICogbG9ja2VkRnVuYygpOyAgLy8gbm9uZVxuICogQHJldHVybnMge2Z1bmN0aW9ufSBBIHdyYXBwZWQgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2NrKGZ1bmMpIHtcbiAgdmFyIGxvY2tlZCwgcXVldWVkQXJnc1RvUmVwbGF5O1xuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gQ29udmVydCBhcmd1bWVudHMgaW50byBhIHJlYWwgYXJyYXkuXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIGlmIChsb2NrZWQpIHtcbiAgICAgIC8vIEtlZXAgYSBjb3B5IG9mIHRoaXMgYXJndW1lbnQgbGlzdCB0byByZXBsYXkgbGF0ZXIuXG4gICAgICAvLyBPSyB0byBvdmVyd3JpdGUgYSBwcmV2aW91cyB2YWx1ZSBiZWNhdXNlIHdlIG9ubHkgcmVwbGF5XG4gICAgICAvLyB0aGUgbGFzdCBvbmUuXG4gICAgICBxdWV1ZWRBcmdzVG9SZXBsYXkgPSBhcmdzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsb2NrZWQgPSB0cnVlO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiByZXBsYXlPckZyZWUoKSB7XG4gICAgICBpZiAocXVldWVkQXJnc1RvUmVwbGF5KSB7XG4gICAgICAgIC8vIE90aGVyIHJlcXVlc3QocykgYXJyaXZlZCB3aGlsZSB3ZSB3ZXJlIGxvY2tlZC5cbiAgICAgICAgLy8gTm93IHRoYXQgdGhlIGxvY2sgaXMgYmVjb21pbmcgYXZhaWxhYmxlLCByZXBsYXlcbiAgICAgICAgLy8gdGhlIGxhdGVzdCBzdWNoIHJlcXVlc3QsIHRoZW4gY2FsbCBiYWNrIGhlcmUgdG9cbiAgICAgICAgLy8gdW5sb2NrIChvciByZXBsYXkgYW5vdGhlciByZXF1ZXN0IHRoYXQgYXJyaXZlZFxuICAgICAgICAvLyB3aGlsZSB0aGlzIG9uZSB3YXMgaW4gZmxpZ2h0KS5cbiAgICAgICAgdmFyIHJlcGxheUFyZ3MgPSBxdWV1ZWRBcmdzVG9SZXBsYXk7XG4gICAgICAgIHF1ZXVlZEFyZ3NUb1JlcGxheSA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmVwbGF5QXJncy51bnNoaWZ0KHJlcGxheU9yRnJlZSk7XG4gICAgICAgIGZ1bmMuYXBwbHkoc2VsZiwgcmVwbGF5QXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NrZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXJncy51bnNoaWZ0KHJlcGxheU9yRnJlZSk7XG4gICAgZnVuYy5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBkb2N1bWVudCBmcmFnbWVudCBieSB0aGUgZ2l2ZW4gSFRNTCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRhZ1N0cmluZ1xuICogQHJldHVybnMge0RvY3VtZW50RnJhZ21lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVGcmFnbWVudCh0YWdTdHJpbmcpIHtcbiAgLy8gVE9ETyBJbXByZW1lbnQgd2l0aCBSYW5nZSNjcmVhdGVDb250ZXh0dWFsRnJhZ21lbnQgd2hlbiBpdCBkcm9wcyBJRTkgc3VwcG9ydC5cbiAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBkaXYuaW5uZXJIVE1MID0gdGFnU3RyaW5nO1xuICB2YXIgY2hpbGROb2RlcyA9IGRpdi5jaGlsZE5vZGVzO1xuICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGROb2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChjaGlsZE5vZGVzW2ldKTtcbiAgfVxuICByZXR1cm4gZnJhZ21lbnQ7XG59XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5kZXRhaWw9dW5kZWZpbmVkXVxuICogQHBhcmFtIHtCb29sZWFufSBbb3B0aW9ucy5jYW5jZWxhYmxlPWZhbHNlXVxuICogQHJldHVybnMge0N1c3RvbUV2ZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3VzdG9tRXZlbnQodHlwZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IGRvY3VtZW50LmRlZmF1bHRWaWV3LkN1c3RvbUV2ZW50KHR5cGUsIGV4dGVuZCh7XG4gICAgY2FuY2VsYWJsZTogZmFsc2UsXG4gICAgZGV0YWlsOiB1bmRlZmluZWQsXG4gIH0sIG9wdGlvbnMpKTtcbn1cbiJdfQ==
