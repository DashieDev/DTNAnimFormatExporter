(function () {
    "use strict";

    const guiElements = {
        exportButton : null,
        importButton : null
    };

    Plugin.register("dtn_model_exporter", {
        title: "DoggyTalentsNext Model Format Exporter",
        author: "DashieDev",
        description: "Plugin to export model for the DoggyTalentsNext Mod",
        icon: "fa-cube",
        tags: ["Animation", "Minecraft: Java Edition"],
        variant: "both",
        version: "1.0.0",
        onload: onPluginLoad.bind(null, guiElements),
        onunload: () => {
            guiElements.exportButton.delete();
            guiElements.importButton.delete();
        }
    });

    function onPluginLoad(guiElements) {
        guiElements.exportButton = new Action("doggytalentsnext_export_model", {
            name: "Export Model to DTN Format",
            description: "Export Model to DTN Format",
            icon: "fa-cube",
            condition: () => true,
            click() {
                let content = "";
                try {
                    content = generateDTNModel();
                } catch (e) {
                    Blockbench.showMessageBox({
                        title: 'Export Failed',
                        icon: 'error',
                        message: 'An error occurred while generating the model:\n\n' + e.message,
                        buttons: ['Close']
                    });
                    console.error(e);
                    return;
                }

                Blockbench.export({
                    type: "Json Files",
                    extensions: ["json"],
                    name: (Project.name || "model") + ".json", 
                    resource_id: "json_entity_model",
                    savetype: "text",
                    content: content
                }, path => {
                    Blockbench.showQuickMessage(
                        `Exported model to: ${path}`, 2000
                    );
                });
            }
        });
        MenuBar.addAction(guiElements.exportButton, "file.export");

        guiElements.importButton = new Action("doggytalentsnext_import_anim", {
            name: "Import Models from DTN Format",
            description: "Import Models from DTN Format",
            icon: "fa-cube",
            condition: () => false,
            click() {
                throw new Error("TODO Not implemented!");
                Blockbench.import({
                    type: "Json Files",
                    extensions: ["json"],
                    readtype: "text",
                    multiple: false,
                    resource_id: "json_entity_model",
                    title: "Import DTN Model",
                    errorbox: true
                }, null);
            }
        });

        MenuBar.addAction(guiElements.importButton, "file.import");
    }

    function generateDTNModel() {
        let root_groups = Group.all.filter(g => g.parent === 'root');
        const auto_deroot = root_groups.length == 1 && root_groups[0].name === 'root';
        if (auto_deroot) {
            root_groups = Group.all.filter(g => g.parent.name === 'root');
        }

        const model = {
            dtn_format_version: 1.0,
            texture_size: [Project.texture_width, Project.texture_height],
            parts: []
        };
        for (const group of root_groups) {
            if (group.export) {
                model.parts.push(parseGroup(group));
            }
        }

        return JSON.stringify(model);
    }

    function parseGroup(group) {
        const part = {
            id: group.name,
            pivot: group.origin.slice(), 
            rotation: group.rotation.slice(),
            cubes: [],
            children: []
        };

        const synthetics = [];
        for (const child of group.children) {
            if (!child.export) continue;

            if (mayGenerateOrUseSynthetic(synthetics, child, group))
                continue;

            if (child instanceof Cube) {
                part.cubes.push(parseCube(child));
            } else if (child instanceof Group) {
                part.children.push(parseGroup(child));
            }
        }

        if (synthetics.length != 0)
            synthetics.forEach(x => part.children.push(x)); 

        [part, ...synthetics].forEach(p => {
            if (p.pivot) p.pivot = fvec(p.pivot);
            if (p.rotation) p.rotation = fvec(p.rotation);
        })

        if (isZeroVec3(part.rotation)) delete part.rotation;
        if (part.cubes.length === 0) delete part.cubes;
        if (part.children.length === 0) delete part.children;

        return part;
    }

    function mayGenerateOrUseSynthetic(existings, cube, parent) {
        if (!(cube instanceof Cube))
            return false;
        const rotation = cube.rotation.slice();
        if (rotation.allEqual(0))
            return false;
        
        let synth = existings.find(isCubeBelongToSyntheticPart.bind(null, cube));
        if (!synth) {
            synth = {
                id: "",
                pivot: cube.origin.slice(), 
                rotation: cube.rotation.slice(),
                cubes: [],
                bb_inline: true //Mark to be inlined when import back to Blockbench
            };
            synth.id = createUniqueNameForSyntheticPart(`${cube.name}_r1`, synth, parent);
            existings.push(synth);
        }
        synth.cubes.push(parseCube(cube));
        return true;
    }

    function createUniqueNameForSyntheticPart(cube_name, synth_part, parent) {
        const group = new Group({
            rotation: synth_part.rotation,
            origin: synth_part.pivot,
            name: cube_name
        });
        group.parent = parent;
        group.createUniqueName(getAllGroups());
        return group.name;
    }

    function isCubeBelongToSyntheticPart(cube, synth_part) {
        if (!synth_part.rotation.equals(cube.rotation)) 
            return false;
        
        const one_axis_rot = synth_part.rotation.filter(n => n).length === 1;
        if (!one_axis_rot)
            return synth_part.pivot.equals(cube.origin);
        
        for (let i = 0; i < 3; i++) {
            if (synth_part.rotation[i] == 0 && synth_part.pivot[i] != cube.origin[i]) 
                return false;
        }
        return true;
    }

    function parseCube(cube) {
        // Illegal negative size guard.
        const size = cube.size().slice();
        if (size.some(x => x < 0)) {
            // Select the bad cube so the user can find it
            if (typeof cube.select === 'function') cube.select(); 

            throw new Error(`Cube "${cube.name}" has a negative size! \nThis is not allowed in DTN format.\nPlease fix it using the Resize Tool.`);
        }

        const cube_data = {
            uv: cube.uv_offset.slice(),
            from: fvec(cube.from),
            to: fvec(cube.to)
        };

        if (cube.mirror_uv) cube_data.mirror = cube.mirror_uv;
        if (cube.inflate != 0) cube_data.inflate = cube.inflate;

        return cube_data;
    }

    //Import TODO

    function isZeroVec3(vec) {
        return vec.allAre(x => x === 0);
    }
    function fvec(vec) {
        return vec.map(trimFloatNumber).map(parseFloat);
    }
})();
