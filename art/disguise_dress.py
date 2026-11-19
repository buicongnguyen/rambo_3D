"""Dress an imported hero body in a disguise, inside Blender.

The one Blender-side copy of src/wardrobe.ts: tints from the outfit's `tints` extras,
body parts named in `hide` removed, and the outfit's pieces hung on the body's joints
(with the woman's `fit`). build_disguise_icons.py and bake_sprites.py both call it, so
wardrobe cards and 2.5D sprites show exactly what the game draws.
"""
import bpy, bmesh, json, os
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, 'public', 'models')
BODIES = ('commando', 'commandoWoman')
# The order of src/wardrobe.ts OUTFITS; "none" is the plain fatigues.
LOOKS = ('none', 'navy', 'pirate', 'knight', 'aodai', 'vietnam', 'mecha')


def linear(hexcode):
    hexcode = hexcode.lstrip('#')
    c = [int(hexcode[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c) + (1,)


def tint(objects, material, hexcode):
    """Recolour a named material on these objects only (copies it first)."""
    rgba = linear(hexcode)
    for o in objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m or m.name.split('.')[0] != material or not m.use_nodes:
                continue
            m = m.copy()
            slot.material = m
            for n in m.node_tree.nodes:
                if n.type == 'MIX' and getattr(n, 'data_type', '') == 'RGBA':
                    n.inputs[7].default_value = rgba


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def joint_of(objects, name):
    return next(o for o in objects if o.type == 'EMPTY' and o.get('joint') == name)


def dress(objects, body, look, models=MODELS):
    """Dress the imported `body` objects in `look`. Returns the outfit's pieces."""
    if look == 'none':
        return []
    kit = load(os.path.join(models, 'disguises.glb'))
    bpy.context.view_layer.update()
    top = next(o for o in kit if o.name.split('.')[0] == 'dz_' + look)
    for material, colour in json.loads(top['tints']).items():
        tint(objects, material, colour)
    for entry in filter(None, top['hide'].split('|')):
        joint_name, material = entry.split(':')
        for o in joint_of(objects, joint_name).children:
            if o.type != 'MESH':
                continue
            slots = [i for i, s in enumerate(o.material_slots) if s.material.name.split('.')[0] == material]
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in slots], context='FACES')
            bm.to_mesh(o.data)
            bm.free()
    pieces = []
    for wear in [o for o in kit if o.parent == top]:
        target = joint_of(objects, wear['wear'])
        fit = wear['fit'] if body == 'commandoWoman' else (1, 1, 1)
        scale = Matrix.Diagonal((fit[0], fit[2], fit[1], 1))  # three.js axes -> Blender
        for piece in [o for o in kit if o.parent == wear]:
            local = wear.matrix_world.inverted() @ piece.matrix_world
            piece.parent = target
            piece.matrix_parent_inverse = Matrix.Identity(4)
            piece.matrix_basis = scale @ local
            pieces.append(piece)
    for o in kit:
        if o not in pieces:
            bpy.data.objects.remove(o, do_unlink=True)
    return pieces
