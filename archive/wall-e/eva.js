(() => {
    window.SampleSpriteLibrary = window.SampleSpriteLibrary || {};

    let clip = (val, min, max) => {
        // for use with theta so that it wont get out of the face
        if (val > max) return max;
        else if (val < min) return min;
        return val;
    };

    let avg = (x, y) => {
        return (x + y)/2;
    };

    let drawOrganicTriangle = (ctx, ax, ay, bx, by, cx, cy, color) => {
        var abx = avg(ax, bx);
        var aby = avg(ay, by);
        var acx = avg(ax, cx);
        var acy = avg(ay, cy);
        var bcx = avg(bx, cx);
        var bcy = avg(by, cy);

        ctx.save();
            ctx.beginPath();
            ctx.moveTo(abx, aby);
            ctx.quadraticCurveTo(bx, by, bcx, bcy);
            ctx.quadraticCurveTo(cx, cy, acx, acy);
            ctx.quadraticCurveTo(ax, ay, abx, aby);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.stroke();
        ctx.restore();
    };

    let drawOrganicRectangle = (ctx, ax, ay, bx, by, cx, cy, dx, dy, color) => {
        var abx = avg(ax, bx);
        var aby = avg(ay, by);
        var adx = avg(ax, dx);
        var ady = avg(ay, dy);
        var bcx = avg(bx, cx);
        var bcy = avg(by, cy);
        var dcx = avg(dx, cx);
        var dcy = avg(dy, cy);

        ctx.save();
            ctx.beginPath();
            ctx.moveTo(abx, aby);
            ctx.quadraticCurveTo(bx, by, bcx, bcy);
            ctx.quadraticCurveTo(cx, cy, dcx, dcy);
            ctx.quadraticCurveTo(dx, dy, adx, ady);
            ctx.quadraticCurveTo(ax, ay, abx, aby);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.stroke();
        ctx.restore();
    };

    let drawEye = (ctx, x, y, r, angle, color) => {
        ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle * Math.PI / 180);
            drawOrganicRectangle(ctx, -r, -r*(5/3), r, -r*(5/3), r, r, -r, r,color);
        ctx.restore();
    };

    let drawFace = (ctx, x, y, size, faceA) => {
        faceA = clip(faceA, -size/6, size/6);
        // Should be using the translate instead of x and y's all the time
        ctx.save();
            //HEAD
            drawOrganicRectangle(ctx, x + size*(3/5), y - size/4, x - size*(3/5), y - size/4, x - size, y + size, x + size, y + size, 'white');

            //FACE
            ctx.translate(0, - faceA);
            drawOrganicRectangle(ctx, x - size/2, y, x + size/2, y,  x + size*(3/4), y + size*(4/5), x - size*(3/4), y + size*(4/5), 'black');

            //EYES
            drawEye(ctx, -size*(2/7), -size*(5/7), size/8, 110, 'rgba(66,165,245,.8)'); //left
            drawEye(ctx, -size*(2/7), -size*(4/7), size/7, 110, 'black'); //shade
            drawEye(ctx, size*(2/7), -size*(5/7), size/8, -110, 'rgba(66,165,245,.8)'); //right
            drawEye(ctx, size*(2/7), -size*(4/7), size/7, -110, 'black'); //shade
        ctx.restore();
    };

    let drawRightArm = (ctx, x, y, size, angle) => {
        var armWidth = size/8;

        ctx.save();
            ctx.translate(x, y);
            ctx.rotate(clip(-angle * Math.PI / 180, -360, 0));
            drawOrganicTriangle(ctx, -armWidth, 0, armWidth, 0, -armWidth/2 ,size, 'white');
        ctx.restore();
    };

    let drawLeftArm = (ctx, x, y, size, angle) => {
        var armWidth = size/8;

        ctx.save();
            ctx.translate(x, y);
            ctx.rotate(clip(angle * Math.PI / 180, 0, 360) );
            drawOrganicTriangle(ctx, -armWidth, 0, armWidth, 0, armWidth/2 ,size, 'white');
        ctx.restore();
    };

    SampleSpriteLibrary.eva = (evaSpecification) => {
        // get the parameter from the specification or set them to the default
        let ctx = evaSpecification.ctx;
        let evaX = evaSpecification.evaX || 0.0; // right and left arms angles in degrees
        let evaY = evaSpecification.evaY || 0.0; //
        let evaHeight = evaSpecification.evaHeight || 500;
        let evaFaceA = evaSpecification.evaFaceA || 0; //tilt angle of the face
        let evaBodyA = evaSpecification.evaBodyA || 0; //for displacement to sides(-20, 20)
        let evaRAA = evaSpecification.evaRAA || 0;
        let evaLAA = evaSpecification.evaLAA || 0;

        const HEIGHT = evaHeight;
        const HEAD_SIZE= HEIGHT/3; //radius of the head
        const ARM_LENGTH = HEIGHT*(4/6);

        var laJ = [-HEIGHT*(4/10), 0]; //left arm joint 1 [x, y]
        var raJ = [HEIGHT*(4/10), 0]; //right arm joint 1 [x, y]
        var aW = HEIGHT*(3/4); //arm width in joint

        ctx.save();
            ctx.translate(evaX, evaY);

            // FACE
            drawFace(ctx, 0, -1.1*HEAD_SIZE, HEAD_SIZE, evaFaceA);

            //TORSO
            var torsoGradient = ctx.createRadialGradient(0, -HEIGHT, 2*HEIGHT, 0, 0, 0);
            torsoGradient.addColorStop(0, 'white');
            torsoGradient.addColorStop(0.7, 'white');
            torsoGradient.addColorStop(.9, 'rgb(240,240,240)');
            torsoGradient.addColorStop(1, 'rgb(200,200,200)');
            drawOrganicTriangle(ctx, laJ[0], laJ[1], clip(evaBodyA, -20, 20), HEIGHT, raJ[0], raJ[1], torsoGradient);
                                                    // -------------^---^
                                                    // Change clip to a function of height

            // LEFT ARM
            laJ = [laJ[0] + aW/12, laJ[1] + aW/6]; // get left arm closer to the body
            drawLeftArm(ctx, laJ[0], laJ[1], ARM_LENGTH, evaLAA);

            //RIGHT ARM
            raJ = [raJ[0] - aW/12, raJ[1] + aW/6]; // get the right arm closer to the body
            drawRightArm(ctx, raJ[0], raJ[1], ARM_LENGTH, evaRAA);
        ctx.restore();
    };

})();
