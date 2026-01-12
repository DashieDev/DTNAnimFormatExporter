// Based off of https://github.com/JannisX11/blockbench-plugins/blob/master/plugins/animation_to_json.js
(function () {
    "use strict";

    const guiElements = {
        exportButton : null,
        importButton : null
    };

    Plugin.register("dtn_format_exporter", {
        title: "DoggyTalentsNext Animation Format Exporter",
        author: "DashieDev",
        description: "Plugin to export animation for the DoggyTalentsNext Mod",
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
        Formats.modded_entity.animation_mode = true;
        guiElements.exportButton = new Action("doggytalentsnext_export_anim", {
            name: "Export Animations to DTN Format",
            description: "Export Animations to DTN Format",
            icon: "movie",
            condition: () => Format.animation_mode,
            click() {
                const animation = Animation.selected;
                if (animation == null) return;
                Blockbench.export({
                    type: "Json Files",
                    extensions: ["json"],
                    name: `${animation.name.replaceAll(".", "_").replace("animation_", "")}.json`,
                    resource_id: "json_entity_animation",
                    savetype: "text",
                    content: JSON.stringify(generateJson(animation))
                }, path => {
                    Blockbench.showQuickMessage(
                        `Exported animation as DTN Format to : ${path}`, 1000
                    )
                });
            }
        });
        MenuBar.addAction(guiElements.exportButton, "animation");

        guiElements.importButton = new Action("doggytalentsnext_import_anim", {
            name: "Import Animations from DTN Format",
            description: "Import Animations from DTN Format",
            icon: "movie",
            condition: () => Format.animation_mode,
            click() {
                const animation = Animation.selected;
                if (animation == null) return;
                Blockbench.import({
                    type: "Json Files",
                    extensions: ["json"],
                    readtype: "text",
                    multiple: true,
                    resource_id: "json_entity_animation",
                    title: "Import DTN Animation",
                    errorbox: true
                }, addAnimationsFromFiles);
            }
        });

        MenuBar.addAction(guiElements.importButton, "animation");
    }

    function generateJson(animation) {
        const result = {
            dtn_format_version: 1.0,
            length: roundTimestamp(animation.length),
            channels: []
        };
        if (animation.loop == "loop") {
            result.loop = true;
        }
        for (const id in animation.animators) {
            const boneAnimator = animation.animators[id];
            if (!(boneAnimator instanceof BoneAnimator)) continue;
            if (boneAnimator.position.length) {
                result.channels.push(generateKeyframes(boneAnimator.name, "position", boneAnimator.position));
            }
            if (boneAnimator.rotation.length) {
                result.channels.push(generateKeyframes(boneAnimator.name, "rotation", boneAnimator.rotation));
            }
            if (boneAnimator.scale.length) {
                result.channels.push(generateKeyframes(boneAnimator.name, "scale", boneAnimator.scale));
            }
        }
        return result;
    }

    function generateKeyframes(part, type, keyframes) {
        const animData = {
            part,
            type,
            keyframes: []
        };
        for (const keyframe of [...keyframes].sort((a, b) => a.time - b.time)) {
            const keyframeData = {
                at: roundTimestamp(keyframe.time),
                interp: keyframe.interpolation
            }
            const keyframeValue = roundKeyframeValue({
                x : sanitizeFloatZero(keyframe.get("x")),
                y : sanitizeFloatZero(keyframe.get("y")),
                z : sanitizeFloatZero(keyframe.get("z"))
            })
            if (!isZeroKeyframe(keyframeValue)) {
                keyframeData.value = [
                    keyframeValue.x, keyframeValue.y, keyframeValue.z
                ]
            }
            animData.keyframes.push(keyframeData);
        }
        return animData;
    }

    function addAnimationsFromFiles(files) {
        let success_count = 0;
        let failure_count = 0;
        files.forEach(file => {
            try {
                const json = JSON.parse(file.content);
                const animName = file.name.replace(".json", "");
                addAnimationFromJson(animName, json);
                ++success_count;
            } catch (err) {
                console.error("Failed to parse DTN Animation:", err);
                ++failure_count;
            }
        });
        let log_message = "";
        if (files.length == 1) {
            const file = files[0];
            log_message = 
            `Import ${success_count == 1 ? "successful" : "failed"}: ${file.name}`;
        } else {
            log_message =
                failure_count > 0 ? 
                `Failed to load ${failure_count}/${files.length} files`
                : `Loaded ${success_count} files.`
        }
        Blockbench.showQuickMessage(log_message, 2000);
    }

    function addAnimationFromJson(animName, jsonData) {
        if (Animation.all.map(x => x.name).includes(animName))
            throw new Error(`Animation already existed: ${animName}`);

        const bbAnim = new Animation({
            name: animName,
            length: jsonData.length,
            loop: jsonData.loop ? "loop" : "once"
        });
        
        const jsonChannels = jsonData.channels; 
        if (!Array.isArray(jsonChannels))
            throw new Error(`Bad Json data: ${animName}`);
        jsonChannels.forEach(generateChannelAndAddTo.bind(null, bbAnim));

        bbAnim.add(true);
        bbAnim.select();
    }

    function generateChannelAndAddTo(bbAnimation, jsonChannel) {
        const bbPart = Group.all.find(g => g.name === jsonChannel.part);
        if (!bbPart)
            return;
        const bbPartAnimator = bbAnimation.getBoneAnimator(bbPart);
        
        const type = jsonChannel.type;
        if (!(type in bbPartAnimator.channels))
            return;

        const bbKeyframes = jsonChannel.keyframes.map(
            generateKeyframe.bind(null, bbPartAnimator, type)
        );
        bbPartAnimator[type] = bbKeyframes;
    }

    function generateKeyframe(bbPartAnimator, type, jsonKeyframe) {
        const value = jsonKeyframe.value || [0, 0, 0];
        return new Keyframe({
            channel: type,
            time: jsonKeyframe.at,
            interpolation: jsonKeyframe.interp || "linear",
            x: value[0], y: value[1], z: value[2], 
        }, null, bbPartAnimator);
    }

    function isZeroKeyframe({x, y, z}) {
        return x === 0 && y === 0 && z === 0;
    }
    function sanitizeFloatZero(num) {
        return isFloatEqual(num, 0) ? 0 : num;
    }
    function isFloatEqual(num, num1) {
        return Math.abs(num - num1) < Number.EPSILON;
    }

    function roundTimestamp(num) {
        return Math.roundTo(num, 4);
    }
    function roundKeyframeValue({x, y, z}) {
        return {
            x: Math.roundTo(x, 2),
            y: Math.roundTo(y, 2),
            z: Math.roundTo(z, 2)
        }
    }
})();
