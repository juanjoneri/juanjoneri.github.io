
(() => {

    let initializeAnimation = (settings) => {

        let currentFrame = 0;

        let ctx = settings.renderingContext;
        let width = settings.width;
        let height = settings.height;
        let scene = settings.scene;

        let previousTimestamp = null;
        let nextFrame = (timestamp) => {
            // Bail-out #1: We just started.
            if (!previousTimestamp) {
                previousTimestamp = timestamp;
                window.requestAnimationFrame(nextFrame);
                return;
            }

            // Bail-out #2: Too soon.
            if (timestamp - previousTimestamp < (1000 / (settings.frameRate || 24))) {
                window.requestAnimationFrame(nextFrame);
                return;
            }

            // Clear the screen
            ctx.clearRect(0, 0, width, height);

            // -----------------------------------------------------------------
            // THIS HERE IS MY CODE --------------------------------------------
            // -----------------------------------------------------------------

            // retreive characters in the scene
            var charCount = scene.length;

            // sotre keyframes in data structure
            // keyFrames[sprite index][keyframe index] =
            //  = Object { frame: 0, evaX: 100, ...,  ease: "easeSinusoidal" }
            var keyFrames = [];
            for (let i = 0; i < charCount; ++i) {
                keyFrames[i] = scene[i].keyframes;
            }


            // retreive all possible parameters of the characters
            // parameters[sprite index] =
            //  = [frame, evaX, ...,  ease]
            Array.prototype.contains = function(elem) {
            // i will need this functionality to find all possible parameters
                for (var i in this) {
                    if (this[i] == elem) return true;
                }
                return false;
            }

            var parameters = [[],[]];
            for (let char = 0; char < charCount; ++char) {
                parameters[char] = new Array();
                for (let frame = 0; frame < keyFrames[char].length; ++frame) {
                    var keys = Object.keys(keyFrames[char][frame]);
                    keys.forEach(function (key) {
                        if (!parameters[char].contains(key))
                            parameters[char].push(key)
                    });
                }
            }

            // Iterate over the parameters and find which two keyfreames are the closest to where we are now and store where the parameter should be in this frame

            var allSpecs = [[],[],[]];
            // first dimension is the char, 2 spec and other dimension (start, startvalue, end, endvalue)
            for (let char = 0; char < charCount; ++char) {
                var drawingSpecs = [[],[]];
                // first dimension is the spec and other dimension (start, startvalue, end, endvalue)
                // for the current character 'char' in the scene

                var paramCount = parameters[char].length;
                for (let i = 1; i < paramCount ; ++i) { // 1 because dont need to look at frame
                    //parameters[char][i] is the current parameter we are looking at from 'char'
                    currentParam = parameters[char][i];

                    // iterate over the keyframes to find which are contiguous to current frame:
                    // store values in a dataStructure

                    var startKeyframe, endKeyframe;
                    var startValue, endValue;
                    var kframes = keyFrames[char]; // keyframes of current character

                    for (let frame = 0; frame < kframes.length; ++frame) {
                        // if frame frame is less thatn current frame save as startKeyframe
                        var frameF = kframes[frame].frame;
                        if (!Object.keys(kframes[frame]).contains(currentParam)) {
                            // only count if it has the parameter we are looking for
                            continue;
                        }
                        if (frameF <= currentFrame) {
                            startKeyframe = frameF; //might be the last specified frame in scene
                            startvalue = kframes[frame][currentParam];
                        } else {
                            endKeyframe = frameF; //might be undefined if the current frame is larger than max in scene
                            endValue = kframes[frame][currentParam];
                            break;
                        }
                    }
                    // first dimension is the spec and other dimension (start, startvalue, end, endvalue)
                    drawingSpecs[i-1] = [startKeyframe, startvalue, endKeyframe, endValue];
                }

                allSpecs[char] = drawingSpecs;
                /*
                - 1 dimension, index of sprite
                - 2 dimension, index of the parameters of that sprite
                - 3 dimension, startF, startV, endF, endV of that param
                    end might be empty if the current frame is posterior to last
                    specified keyframe in scene

                    allSpecs.length (num of sprites)
                    allSpecs[0].length (num of params)
                    allSpecs[0][0].length (4)

                */
            }

            charLoop:
            for (let char = 0; char < charCount; ++char) {
                var startF = 0, startV = 1, endF = 2, endV = 3;
                var numOfParams = allSpecs[char].length;
                var stateInfo = {ctx: ctx};

                // Set the ease as the startV or linear
                // ease is the last parameter
                let ease = KeyframeTweener[allSpecs[char][numOfParams - 1][startV] || "linear"];

                for (let param = 0; param < numOfParams -1; ++param) {
                    //we skip ease because we have it already
                    var startValue = allSpecs[char][param][startV];
                    var endValue = allSpecs[char][param][endV];
                    if (isNaN(endValue)) {
                        // we run our of specifications for this param, not draw the sprite
                        continue charLoop;
                    }
                    var duration = allSpecs[char][param][endF] - allSpecs[char][param][startF] + 1;
                    var distance = endValue - startValue;
                    let currentTweenFrame = currentFrame - allSpecs[char][param][startF];

                    stateInfo[parameters[char][param + 1]] =
                        ease(currentTweenFrame, startValue, distance, duration);
                }


                // Finally draw the character
                SampleSpriteLibrary[scene[char].sprite](
                    stateInfo
                );
            }

            console.log("frame: " + currentFrame);

            // -----------------------------------------------------------------
            // THIS HERE WAS MY CODE --------------------------------------------
            // -----------------------------------------------------------------

            // Move to the next frame.
            currentFrame += 1;
            previousTimestamp = timestamp;
            window.requestAnimationFrame(nextFrame);
        };

        window.requestAnimationFrame(nextFrame);
    };

    // Ease functions library (add a couple more)
    window.KeyframeTweener = {

        linear: (currentTime, start, distance, duration) => {
            let percentComplete = currentTime / duration;
            return distance * percentComplete + start;
        },

        quadEaseIn: (currentTime, start, distance, duration) => {
            let percentComplete = currentTime / duration;
            return distance * percentComplete * percentComplete + start;
        },

        quadEaseOut: (currentTime, start, distance, duration) => {
            let percentComplete = currentTime / duration;
            return -distance * percentComplete * (percentComplete - 2) + start;
        },

        quadEaseInAndOut: (currentTime, start, distance, duration) => {
            let percentComplete = currentTime / (duration / 2);
            return (percentComplete < 1) ?
                    (distance / 2) * percentComplete * percentComplete + start :
                    (-distance / 2) * ((percentComplete - 1) * (percentComplete - 3) - 1) + start;
        },

        easeSinusoidal: (currentTime, start, distance, duration) => {
            let percentComplete = currentTime / duration;
            return (distance*percentComplete + distance/4*Math.sin(currentTime*2*Math.PI/duration) + start);
            // negative parameters can cause problems when using non-monothonic easing functions
        },

        easeOvershoot: (currentTime, start, distance, duration) => {
            // this variable names are not helping.. start what: value time...?
            var x = currentTime;
            var a = start;
            var b = start + distance;
            var xi = 0;
            var xf = duration;
            return -(2 * (x - xi)/(xf - xi) - 1)^2 + 1 + (b - a)/(xf - xi) * (x - xi) + a;
        },

        initialize: initializeAnimation
    };
})();
