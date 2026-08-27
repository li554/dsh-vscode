window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-super-injector",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// The "插件" settings tab this plugin used to contribute rendered a blank
		// page (its native render built the DOM but never mounted it into the
		// settings roster). It has been removed so the settings navigation no
		// longer shows an empty tab. The server-side /super-injector/api routes
		// still mount and the plugin keeps functioning.
		function apply() {}
		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});