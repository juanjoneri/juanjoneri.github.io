
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

            // TIterate through the sprites in the scene (i)
            for (let i = 0, maxI = scene.length; i < maxI; i += 1) {
                // Iterate throught the keyframes of every sprite (j)
                for (let j = 0, maxJ = scene[i].keyframes.length - 1; j < maxJ; j += 1) {

                    // Current frame is between two keyframes
                    if ((scene[i].keyframes[j].frame <= currentFrame)
                    && (currentFrame <= scene[i].keyframes[j + 1].frame)) {

                        // We are between two keyframes (j) and (j+1)
                        let startKeyframe = scene[i].keyframes[j];
                        let endKeyframe = scene[i].keyframes[j + 1];

                        ctx.save();

                            // Set up our start and distance values
                            let ease = KeyframeTweener[startKeyframe.ease || "linear"];
                            let currentTweenFrame = currentFrame - startKeyframe.frame;
                            let duration = endKeyframe.frame - startKeyframe.frame + 1;

                            // store all start information in startArray
                            var startArray = new Array();
                            for (var startData in startKeyframe) {
                                startArray.push(startKeyframe[startData] || 0);
                            }
                            // Store all end information in endArray
                            var endArray = new Array();
                            for (var endData in endKeyframe) {
                                endArray.push(endKeyframe[endData] || 0);
                            }
                            // use start and end information to compute current status of the properties
                            var properties = new Array();
                            for (var k = 0; k < startArray.length; k ++) {
                                properties.push( ease(currentTweenFrame, startArray[k], endArray[k] - startArray[k], duration) );
                            }
                            // convert the propeties into an object that cna be passed into sprite's cosntructor
                            var stateInfo = {ctx: ctx};
                            var keys = Object.keys(startKeyframe);
                            for (var k = 1; k < startArray.length -1; k ++) {
                                stateInfo[ keys[k] ] = properties[k];
                            }

                            // Draw the sprite.
                            //console.log(stateInfo);
                            SampleSpriteLibrary[scene[i].sprite](
                                stateInfo
                            );

                        ctx.restore();
                    }
                }
            }

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

        easeOutCirc: (currentTime, start, distance, duration) => {
            // t: current time, b: begInnIng value, c: change In value, d: duration
            return distance * Math.sqrt( 1 - ( currentTime = currentTime / duration - 1 ) * currentTime ) + start;
        },


        easeSinusoidal: (currentTime, start, distance, duration) => {
            let percentComplete = currentTime / duration;
            return Math.max(0, distance*percentComplete + distance/4*Math.sin(currentTime*2*Math.PI/duration) + start);
            // negative parameters can cause problems when using non-monothonic easing functions
        },

        initialize: initializeAnimation
    };
})();
