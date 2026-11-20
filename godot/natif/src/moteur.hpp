// MoteurNatif : la course en C++, vue de Godot. La grille est faite en GDScript (Course), puis
// recopiée ici ; chaque pas tourne en C++, et GDScript relit l'état pour les écrans.
#pragma once
#include "course.hpp"
#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/variant/dictionary.hpp>
#include <godot_cpp/variant/packed_float64_array.hpp>
#include <godot_cpp/variant/packed_int32_array.hpp>
#include <godot_cpp/variant/packed_string_array.hpp>

namespace godot {

class MoteurNatif : public RefCounted {
	GDCLASS(MoteurNatif, RefCounted)
	grip::Course c;

protected:
	static void _bind_methods();

public:
	void piste(const Dictionary &d);
	int ajoute(const Dictionary &modele, const Dictionary &etat);
	void regle(const Dictionary &p);
	void prepare();
	PackedInt32Array pas(double gaz, double selJoueur);
	void pas_seul(double gaz, double sel, double temps);
	PackedFloat64Array etats() const;
	PackedStringArray champs() const;
	PackedFloat64Array tours(int i) const;
	Dictionary course() const;
	double ecart_fantome() const;
	void pose(int i, const Dictionary &e);
	int hasard() const { return int(c.hasard.etat); }
	void pose_hasard(int64_t e) { c.hasard.etat = uint32_t(e); }
};

} // namespace godot
