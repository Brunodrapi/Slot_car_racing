#include "moteur.hpp"
#include <gdextension_interface.h>
#include <godot_cpp/core/defs.hpp>
#include <godot_cpp/godot.hpp>

using namespace godot;

static void initialise(ModuleInitializationLevel niveau) {
	if (niveau != MODULE_INITIALIZATION_LEVEL_SCENE) return;
	GDREGISTER_CLASS(MoteurNatif);
}

static void termine(ModuleInitializationLevel) {}

extern "C" GDExtensionBool GDE_EXPORT grip_init(GDExtensionInterfaceGetProcAddress p, const GDExtensionClassLibraryPtr l, GDExtensionInitialization *init) {
	GDExtensionBinding::InitObject o(p, l, init);
	o.register_initializer(initialise);
	o.register_terminator(termine);
	o.set_minimum_library_initialization_level(MODULE_INITIALIZATION_LEVEL_SCENE);
	return o.init();
}
