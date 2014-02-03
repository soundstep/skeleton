/*
Copyright (c) | 2013 | infuse.js | Romuald Quantin | www.soundstep.com | romu@soundstep.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function(infuse) {

    'use strict';

	infuse.version = '0.6.9';

	// regex from angular JS (https://github.com/angular/angular.js)
	var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
	var FN_ARG_SPLIT = /,/;
	var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
	var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

	if(!Array.prototype.contains) {
		Array.prototype.contains = function(value) {
			var i = this.length;
			while (i--) {
				if (this[i] === value) {
					return true;
				}
			}
			return false;
		};
	}

	infuse.InjectorError = {
		MAPPING_BAD_PROP: '[Error infuse.Injector.mapClass/mapValue] the first parameter is invalid, a string is expected',
		MAPPING_BAD_VALUE: '[Error infuse.Injector.mapClass/mapValue] the second parameter is invalid, it can\'t null or undefined, with property: ',
		MAPPING_BAD_CLASS: '[Error infuse.Injector.mapClass/mapValue] the second parameter is invalid, a function is expected, with property: ',
		MAPPING_BAD_SINGLETON: '[Error infuse.Injector.mapClass] the third parameter is invalid, a boolean is expected, with property: ',
		MAPPING_ALREADY_EXISTS: '[Error infuse.Injector.mapClass/mapValue] this mapping already exists, with property: ',
		CREATE_INSTANCE_INVALID_PARAM: '[Error infuse.Injector.createInstance] invalid parameter, a function is expected',
		NO_MAPPING_FOUND: '[Error infuse.Injector.getInstance] no mapping found',
		INJECT_INSTANCE_IN_ITSELF_PROPERTY: '[Error infuse.Injector.getInjectedValue] A matching property has been found in the target, you can\'t inject an instance in itself',
		INJECT_INSTANCE_IN_ITSELF_CONSTRUCTOR: '[Error infuse.Injector.getInjectedValue] A matching constructor parameter has been found in the target, you can\'t inject an instance in itself'
	};

	var MappingVO = function(prop, value, cl, singleton) {
		this.prop = prop;
		this.value = value;
		this.cl = cl;
		this.singleton = singleton || false;
	};

	var validateProp = function(prop) {
		if (typeof prop !== 'string') {
			throw new Error(infuse.InjectorError.MAPPING_BAD_PROP);
		}
	};

	var validateValue = function(prop, val) {
		if (val === undefined || val === null) {
			throw new Error(infuse.InjectorError.MAPPING_BAD_VALUE + prop);
		}
	};

	var validateClass = function(prop, val) {
		if (typeof val !== 'function') {
			throw new Error(infuse.InjectorError.MAPPING_BAD_CLASS + prop);
		}
	};

	var validateBooleanSingleton = function(prop, singleton) {
		if (typeof singleton !== 'boolean') {
			throw new Error(infuse.InjectorError.MAPPING_BAD_SINGLETON + prop);
		}
	};

	var validateConstructorInjectionLoop = function(name, cl) {
		var params = infuse.getConstructorParams(cl);
		if (params.contains(name)) {
			throw new Error(infuse.InjectorError.INJECT_INSTANCE_IN_ITSELF_CONSTRUCTOR);
		}
	};

	var validatePropertyInjectionLoop = function(name, target) {
		if (target.hasOwnProperty(name)) {
			throw new Error(infuse.InjectorError.INJECT_INSTANCE_IN_ITSELF_PROPERTY);
		}
	};

	infuse.Injector = function() {
		this.mappings = {};
		this.parent = null;
	};

	infuse.getConstructorParams = function(cl) {
		var args = [];
		function extractName(all, underscore, name) {
			args.push(name);
		}
		var clStr = cl.toString().replace(STRIP_COMMENTS, '');
		var argsFlat = clStr.match(FN_ARGS);
		var spl = argsFlat[1].split(FN_ARG_SPLIT);
		for (var i=0; i<spl.length; i++) {
			var arg = spl[i];
			arg.replace(FN_ARG, extractName);
		}
		return args;
	};

	infuse.Injector.prototype = {

		createChild: function() {
			var injector = new infuse.Injector();
			injector.parent = this;
			return injector;
		},

		getMappingVo: function(prop) {
			if (!this.mappings) {
				return null;
			}
			if (this.mappings[prop]) {
				return this.mappings[prop];
			}
			if (this.parent) {
				return this.parent.getMappingVo(prop);
			}
			return null;
		},

		mapValue: function(prop, val) {
			if (this.mappings[prop]) {
				throw new Error(infuse.InjectorError.MAPPING_ALREADY_EXISTS + prop);
			}
			validateProp(prop);
			validateValue(prop, val);
			this.mappings[prop] = new MappingVO(prop, val, undefined, undefined);
			return this;
		},

		mapClass: function(prop, cl, singleton) {
			if (this.mappings[prop]) {
				throw new Error(infuse.InjectorError.MAPPING_ALREADY_EXISTS + prop);
			}
			validateProp(prop);
			validateClass(prop, cl);
			if (singleton) {
				validateBooleanSingleton(prop, singleton);
			}
			this.mappings[prop] = new MappingVO(prop, null, cl, singleton);
			return this;
		},

		removeMapping: function(prop) {
			this.mappings[prop] = null;
			delete this.mappings[prop];
			return this;
		},

		hasMapping: function(prop) {
			return !!this.mappings[prop];
		},

		hasInheritedMapping: function(prop) {
			return !!this.getMappingVo(prop);
		},

		getMapping: function(value) {
			for (var name in this.mappings) {
				if (this.mappings.hasOwnProperty(name)) {
					var vo = this.mappings[name];
					if (vo.value === value || vo.cl === value) {
						return vo.prop;
					}
				}
			}
			return undefined;
		},

		getValue: function(prop) {
			var vo = this.mappings[prop];
			if (!vo) {
				if (this.parent) {
					return this.parent.getValue.apply(this.parent, arguments);
				}
				else {
					throw new Error(infuse.InjectorError.NO_MAPPING_FOUND);
				}
			}
			if (vo.cl) {
				var args = Array.prototype.slice.call(arguments);
				args[0] = vo.cl;
				if (vo.singleton) {
					if (!vo.value) {
						vo.value = this.createInstance.apply(this, args);
					}
					return vo.value;
				}
				else {
					return this.createInstance.apply(this, args);
				}
			}
			return vo.value;
		},

		getClass: function(prop) {
			var vo = this.mappings[prop];
			if (!vo) {
				if (this.parent) {
					return this.parent.getClass(prop);
				}
				else {
					return undefined;
				}
			}
			if (vo.cl) {
				return vo.cl;
			}
			return undefined;
		},

		instantiate: function(TargetClass) {
			if (typeof TargetClass !== 'function') {
				throw new Error(infuse.InjectorError.CREATE_INSTANCE_INVALID_PARAM);
			}
			var args = [null];
			var params = infuse.getConstructorParams(TargetClass);
			for (var i=0; i<params.length; i++) {
				if (arguments[i+1] !== undefined && arguments[i+1] !== null) {
					// argument found
					args.push(arguments[i+1]);
				}
				else {
					var name = params[i];
					// no argument found
					var vo = this.getMappingVo(name);
					if (!!vo) {
						// found mapping
						var val = this.getInjectedValue(vo, name);
						args.push(val);
					}
					else {
						// no mapping found
						args.push(undefined);
					}
				}
			}
			return new (Function.prototype.bind.apply(TargetClass, args))();
		},

		inject: function (target, isParent) {
			if (this.parent) {
				this.parent.inject(target, true);
			}
			for (var name in this.mappings) {
				if (this.mappings.hasOwnProperty(name)) {
					var vo = this.getMappingVo(name);
					if (target.hasOwnProperty(vo.prop) || (target.constructor && target.constructor.prototype && target.constructor.prototype.hasOwnProperty(vo.prop)) ) {
						target[name] = this.getInjectedValue(vo, name);
					}
				}
			}
			if (typeof target.postConstruct === 'function' && !isParent) {
				target.postConstruct();
			}
			return this;
		},

		getInjectedValue: function(vo, name) {
			var val = vo.value;
			var injectee;
			if (vo.cl) {
				if (vo.singleton) {
					if (!vo.value) {
						validateConstructorInjectionLoop(name, vo.cl);
						vo.value = this.instantiate(vo.cl);
						injectee = vo.value;
					}
					val = vo.value;
				}
				else {
					validateConstructorInjectionLoop(name, vo.cl);
					val = this.instantiate(vo.cl);
					injectee = val;
				}
			}
			if (injectee) {
				validatePropertyInjectionLoop(name, injectee);
				this.inject(injectee);
			}
			return val;
		},

		createInstance: function() {
			var instance = this.instantiate.apply(this, arguments);
			this.inject(instance);
			return instance;
		},

		getValueFromClass: function(cl) {
			for (var name in this.mappings) {
				if (this.mappings.hasOwnProperty(name)) {
					var vo = this.mappings[name];
					if (vo.cl === cl) {
						if (vo.singleton) {
							if (!vo.value) {
								vo.value = this.createInstance.apply(this, arguments);
							}
							return vo.value;
						}
						else {
							return this.createInstance.apply(this, arguments);
						}
					}
				}
			}
			if (this.parent) {
				return this.parent.getValueFromClass.apply(this.parent, arguments);
			} else {
				throw new Error(infuse.InjectorError.NO_MAPPING_FOUND);
			}
		},

		dispose: function() {
			this.mappings = {};
		}

	};

	if (!Function.prototype.bind) {
		Function.prototype.bind = function bind(that) {
			var target = this;
			if (typeof target !== 'function') {
				throw new Error('Error, you must bind a function.');
			}
			var args = Array.prototype.slice.call(arguments, 1); // for normal call
			var bound = function () {
				if (this instanceof bound) {
					var F = function(){};
					F.prototype = target.prototype;
					var self = new F();
					var result = target.apply(
						self,
						args.concat(Array.prototype.slice.call(arguments))
					);
					if (Object(result) === result) {
						return result;
					}
					return self;
				} else {
					return target.apply(
						that,
						args.concat(Array.prototype.slice.call(arguments))
					);
				}
			};
			return bound;
		};
	}

	// register for AMD module
	if (typeof define === 'function' && typeof define.amd !== 'undefined') {
		define("infuse", infuse);
	}

	// export for node.js
	if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
		module.exports = infuse;
	}
	if (typeof exports !== 'undefined') {
		exports = infuse;
	}

})(this['infuse'] = this['infuse'] || {});

/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

(function (global, infuse, signals) {

	'use strict';

    var calista = global.calista = global.calista || {
        version: '0.0.0'
    };

	var utils = calista.utils = {};

    utils.applyProperties = function(target, extension, bindToExtension, list) {
		if (Object.prototype.toString.apply(list) === '[object Array]') {
			for (var i = 0, l = list.length; i < l; i++) {
				if (target[list[i]] === undefined || target[list[i]] === null) {
					if (bindToExtension && typeof extension[list[i]] === 'function') {
						target[list[i]] = extension[list[i]].bind(extension);
					}
					else {
						target[list[i]] = extension[list[i]];
					}
				}
			}
		}
		else {
			for (var prop in extension) {
				if (bindToExtension && typeof extension[prop] === 'function') {
					target[prop] = extension[prop].bind(extension);
				}
				else {
					target[prop] = extension[prop];
				}
			}
		}
	};

    utils.augment = function (target, extension, list) {
		if (!extension.prototype || !target.prototype) {
			return;
		}
		if (Object.prototype.toString.apply(list) === '[object Array]') {
			for (var i = 0, l = list.length; i < l; i++) {
				if (!target.prototype[list[i]]) {
					target.prototype[list[i]] = extension.prototype[list[i]];
				}
			}
		}
		else {
			for (var prop in extension.prototype) {
				if (!target.prototype[prop]) {
					target.prototype[prop] = extension.prototype[prop];
				}
			}
		}
	};

    utils.inherit = function (parent, obj) {
		var Subclass;
		if (obj && obj.hasOwnProperty('constructor')) {
			// use constructor if defined
			Subclass = obj.constructor;
		} else {
			// call the super constructor
			Subclass = function () {
				return parent.apply(this, arguments);
			};
		}
		// set the prototype chain to inherit from the parent without calling parent's constructor
		var Chain = function(){};
		Chain.prototype = parent.prototype;
		Subclass.prototype = new Chain();
		// add obj properties
		if (obj) {
			utils.applyProperties(Subclass.prototype, obj);
		}
		// point constructor to the Subclass
		Subclass.prototype.constructor = Subclass;
		// set super class reference
		Subclass.parent = parent.prototype;
		// add extend shortcut
		Subclass.extend = function (obj) {
			return utils.inherit(Subclass, obj);
		};
		return Subclass;
	};

    utils.extend = function (obj) {
		return utils.inherit(function () {
		}, obj);
	};



	// register for AMD module
	/* globals define:false */
	if (typeof define === 'function' && typeof define.amd !== 'undefined') {
		define('calista', calista);
	}

	// export for node.js
	if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
		module.exports = calista;
	}
	else {
		window.calista = calista;
	}

})(this, this.infuse, this.signals);