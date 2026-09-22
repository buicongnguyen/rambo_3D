"""Reusable beveled combat blades, at the character's common grip origin (+Y up/+Z forward in glTF).
Run: blender -b --python art/build_infantry_kit.py
"""
import bpy, math, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,metal=0,rough=.5):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
steel=material('Blade brushed steel',(.45,.52,.54),.8,.28)
edge=material('Honed bevel',(.85,.91,.9),.9,.18)
grip=material('Wrapped dark leather',(.10,.075,.055),0,.9)
metal=material('Blackened guard',(.07,.09,.1),.7,.48)
amber=material('Amber blade marking',(.95,.33,.025),.2,.36)
created=[]
def box(name,loc,size,mat,bevel=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    m=o.modifiers.new('Edge wear','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.append(mat);created.append(o);return o
for name,length,width in [('weapon_knife',.42,.10),('weapon_sword',1.13,.14),('projectile_knife',.32,.10)]:
    created=[]
    # Diamond section and separate honed facets; the blade has thickness and a tapered point.
    vertices=[]
    for y,w in [(-.10,width/2),(-.10-length*.72,width/2),(-.10-length,0)]:
        vertices.extend([(-w,y,0),(0,y,.025),(w,y,0),(0,y,-.025)])
    faces=[]
    for j in [0,4]:
        for i in range(4):faces.append((j+i,j+(i+1)%4,j+4+(i+1)%4,j+4+i))
    faces.append((3,2,1,0))
    mesh=bpy.data.meshes.new('Forged blade');mesh.from_pydata(vertices,[],faces);mesh.materials.append(steel);mesh.materials.append(edge)
    o=bpy.data.objects.new('Tapered steel blade',mesh);bpy.context.collection.objects.link(o);created.append(o)
    for i,p in enumerate(mesh.polygons):p.material_index=i%2
    box('Crossguard',(0,-.09,0),(width*1.7,.035,.06),metal)
    box('Leather grip',(0,.035,0),(.065,.21,.065),grip,.014)
    for y in [-.04,0,.04,.08]:box('Grip winding',(0,y,0),(.07,.015,.071),metal,.004)
    box('Pommel',(0,.15,0),(.078,.045,.078),metal,.009)
    box('Amber identification',(0,-.14,.027),(width*.4,.06,.006),amber,.001)
    shared={}
    for o in created:
        key=(tuple(m.name for m in o.data.materials),tuple(tuple(round(c,5) for c in v.co) for v in o.data.vertices))
        if key in shared:o.data=shared[key]
        else:shared[key]=o.data
    bpy.ops.object.select_all(action='DESELECT')
    for o in created:o.select_set(True)
    bpy.context.view_layer.objects.active=created[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models',name+'.glb'),export_format='GLB',use_selection=True,export_yup=True)
    collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
    for o in created:
        for c in list(o.users_collection):c.objects.unlink(o)
        collection.objects.link(o)
    for o in created:o.location.x+=['weapon_knife','weapon_sword','projectile_knife'].index(name)*2
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','infantry-kit.blend'))
