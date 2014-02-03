
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