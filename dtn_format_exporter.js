// Based off of https://github.com/JannisX11/blockbench-plugins/blob/master/plugins/animation_to_json.js
(function () {
    var menuButton;

    Plugin.register("dtn_format_exporter", {
        title: "DoggyTalentsNext Animation Format Exporter",
        author: "DashieDev",
        description: "Plugin to export animation for the DoggyTalentsNext Mod",
        icon: "fa-cube",
        tags: ["Animation", "Minecraft: Java Edition"],
        variant: "both",
        version: "1.0.0",
        onload() {
            Formats.modded_entity.animation_mode = true;
            menuButton = new Action("doggytalentsnext_export_anim", {
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
            MenuBar.addAction(menuButton, "animation");
        },
        onunload() {
            menuButton.delete();
        }
    });

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
