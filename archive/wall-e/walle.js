(() => {
    window.SampleSpriteLibrary = window.SampleSpriteLibrary || {};

    //Colors
    const ORANGE ='#FFA000';
    const DARK_ORANGE = '#E59400';
    const BLACK = 'black';
    const BROWN = '#4E342E';
    const DARK_BROWN = '#3E2723';
    const LIGHT_BROWN = '#795548';

    const LIGHT_GREY = '#ECEFF1';
    const MILD_GREY = '#9E9E9E';
    const GREY = '#BDBDBD';
    const DARK_GREY = '#424242';
    const DARKEST_GREY = '#212121';

    const GREEN = '#8BC34A';
    const RED = '#FF3D00';

    let clip = (val, min, max) => {
        // for use with theta so that it wont get out of the face
        if (val > max) return max;
        else if (val < min) return min;
        return val;
    };

    let drawLine = (ctx, ax, ay, bx, by, color) => {
        ctx.save();
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.closePath();
        ctx.restore();
    };

    let drawDetail = (ctx, x, y, size, color) => {
        // un poco de mugre en walle
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI/4);
        ctx.lineCap = 'round';
        ctx.lineWidth = size/2;

        for (var i = 0; i < 4; i ++) {
            drawLine(ctx, -size, size/2, size, size/2, color);
            ctx.rotate(Math.PI/2);
        }
        ctx.restore();

    };

    let drawCircle = (ctx, x, y, r, color) => {
        ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, r , 0, 2*Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
        ctx.restore();
    };

    let drawTriangle = (ctx, ax, ay, bx, by, cx, cy, color) => {
        ctx.save();
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.lineTo(cx, cy);
            ctx.fillStyle = color;
            ctx.fill();
        ctx.restore();
    };

    let drawRectangle = (ctx, ax, ay, bx, by, cx, cy, dx, dy, color) => {
        ctx.save();
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.lineTo(cx, cy);
            ctx.lineTo(dx, dy);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        ctx.restore();
    };

    // js does not support overload?
    let drawRectangle2 = (ctx, x, y, w, h, color) => {
        drawRectangle(ctx, x-w/2, y-h/2, x + w/2, y-h/2, x+w/2, y + h/2, x-w/2, y+h/2, color);
    };

    let drawWeel = (ctx, x, y, h) => {
        ctx.save();
        ctx.translate(x, y);
        drawRectangle2(ctx, 0, 0, h/2, h, BROWN);

        // Draw horizontal lines
        ctx.lineWidth = h/20;
        for (var i = -h/2; i <= h/2; i += h/6)
            drawLine(ctx, -h/4, i, h/4, i, DARK_BROWN);

        // Draw vertical lines
        for (var i = -h/4 + h/6; i <= h/4 - h/6; i += h/6)
            drawLine(ctx, i, -h/2, i, h/2, DARK_BROWN);

        ctx.restore();
    };

    let drawHand = (ctx, x, y, angle, size) => {
        ctx.save();
        ctx.translate(x, y);
        drawRectangle2(ctx, 0, 0 - angle, size/2, size/2, GREY);
        drawRectangle2(ctx, 0, size/4 - angle, size/2, size/6, MILD_GREY);
        ctx.lineWidth = size/12;
        drawLine(ctx, 0, size/4 - angle, 0, -angle, DARK_GREY);

        ctx.restore();
    };

    let drawRightEye = (ctx, x, y, angle, size) => {
        var width = size;
        var height = size*(2/3);
        ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            // outer shape
            ctx.save();
                ctx.beginPath();
                ctx.moveTo(width/2 - width/2, -height/2);
                ctx.lineTo(width/2 - width/2, 0);
                ctx.quadraticCurveTo(width/2- width/2, height/2, width/2-width/4, height/2);
                ctx.lineTo(width/2, height/2);
                ctx.quadraticCurveTo(width/2 + width/2, height/2,width/2 + width/2, 0);
                ctx.quadraticCurveTo(width/2 +width/2, -height/2, width/2, -height/2);
                ctx.closePath();
                ctx.fillStyle = LIGHT_GREY;
                ctx.fill();
                ctx.lineWidth = size/12;
                ctx.strokeStyle = DARK_GREY;
                ctx.stroke();
            ctx.restore();

            // details
            ctx.save();
            drawCircle(ctx, width*(4/5), height/4, height/20, MILD_GREY)
            drawCircle(ctx, width*(4/5), -height/4, height/20, MILD_GREY)
            ctx.restore();

            // pupila
            ctx.save();
                drawCircle(ctx, width/3, 0, height/3, DARK_GREY);
                drawCircle(ctx, width/3, 0, height/4, DARKEST_GREY);
                drawCircle(ctx, width/3, 0, height/8, DARK_GREY);
                drawCircle(ctx, width/3, 0, height/14, DARKEST_GREY);
                drawCircle(ctx, width/3, 0, height/25, LIGHT_GREY);
                drawCircle(ctx, width/4, -height/6, height/12, LIGHT_GREY);
            ctx.restore();

        ctx.restore();
    };

    let drawLeftEye = (ctx, x, y, angle, size) => {
        var width = -size;
        var height = size*(2/3);
        ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            // outer shape
            ctx.save();
                ctx.beginPath();
                ctx.moveTo(width/2 - width/2, -height/2);
                ctx.lineTo(width/2 - width/2, 0);
                ctx.quadraticCurveTo(width/2- width/2, height/2, width/2-width/4, height/2);
                ctx.lineTo(width/2, height/2);
                ctx.quadraticCurveTo(width/2 + width/2, height/2,width/2 + width/2, 0);
                ctx.quadraticCurveTo(width/2 +width/2, -height/2, width/2, -height/2);
                ctx.closePath();
                ctx.fillStyle = LIGHT_GREY;
                ctx.fill();
                ctx.lineWidth = size/12;
                ctx.strokeStyle = DARK_GREY;
                ctx.stroke();
            ctx.restore();

            // details
            ctx.save();
            drawCircle(ctx, width*(4/5), height/4, height/20, MILD_GREY)
            drawCircle(ctx, width*(4/5), -height/4, height/20, MILD_GREY)
            ctx.restore();

            // pupila
            ctx.save();
                drawCircle(ctx, width/3, 0, height/3, DARK_GREY);
                drawCircle(ctx, width/3, 0, height/4, DARKEST_GREY);
                drawCircle(ctx, width/3, 0, height/8, DARK_GREY);
                drawCircle(ctx, width/3, 0, height/14, DARKEST_GREY);
                drawCircle(ctx, width/3, 0, height/25, LIGHT_GREY);
                drawCircle(ctx, width/4, -height/6, height/12, LIGHT_GREY);
            ctx.restore();

        ctx.restore();
    };

    SampleSpriteLibrary.walle = (walleSpecification) => {
        // The center of walle is defined in the center of its torso!

        let ctx = walleSpecification.ctx;
        let walleX = walleSpecification.walleX || 0.0;
        let walleY = walleSpecification.walleY || 0.0;
        let walleHeight = walleSpecification.walleHeight || 0.0;
        let walleREA = walleSpecification.walleREA || 0;
        let walleLEA = walleSpecification.walleLEA || 0;
        let walleRHA = walleSpecification.walleRHA || 0;
        let walleLHA = walleSpecification.walleLHA || 0;

        const HEIGHT = walleHeight/2;
        const WIDTH = HEIGHT*5/4;

        ctx.save();
        ctx.translate(walleX, walleY);

        // Torso
        drawRectangle(ctx, -WIDTH/2, -HEIGHT/2, WIDTH/2, -HEIGHT/2, WIDTH/2, HEIGHT/2, -WIDTH/2, HEIGHT/2, ORANGE);
        drawRectangle2(ctx, 0, 0, WIDTH, HEIGHT*(4/5) ,DARK_ORANGE);
        drawDetail(ctx, WIDTH/4, 0, HEIGHT/20, LIGHT_BROWN);
        drawCircle(ctx, WIDTH/4, HEIGHT/3, HEIGHT/18, RED);
        drawRectangle2(ctx, WIDTH/10, HEIGHT/3, WIDTH/6, HEIGHT/14, DARK_BROWN);

        // Neck ?
        ctx.save();
            var neckWidth = WIDTH*(3/4);
            var neckHeight = HEIGHT*(2/5);
            var neckY = -HEIGHT*(4/10);

            ctx.lineWidth = neckWidth/7;
            drawLine(ctx, 0, neckY, 0, -HEIGHT*(7/6), ORANGE); //join the eyes
            drawRectangle2(ctx, 0, neckY, neckWidth, neckHeight , BROWN); // neck itself

            ctx.lineWidth = neckHeight;
            drawLine(ctx, -neckWidth/4, neckY, neckWidth/4, neckY, DARK_GREY); // thick line in neck
            ctx.lineWidth = neckHeight*(3/5);
            drawLine(ctx, -neckWidth/2, neckY, neckWidth/2, neckY, DARK_BROWN); // thick line in neck
            drawDetail(ctx, -neckWidth/3, neckY, HEIGHT/15, 'rgba(229,148,0,.2)');
            ctx.lineWidth = neckHeight/16;
            ctx.lineCap = 'round';
            for (var i = - neckHeight/4; i <= neckHeight/4; i += neckHeight/8)
                drawLine(ctx, 0, neckY + i, neckWidth/6, neckY + i, GREEN)

            ctx.lineWidth = neckHeight/6;
            drawLine(ctx, -neckWidth/2, neckY -  neckHeight/2, neckWidth/2, neckY -  neckHeight/2, BLACK); //line in top of eck
        ctx.restore();

        //WEELSS
        drawWeel(ctx, WIDTH/2, HEIGHT/3, HEIGHT*(2/3));
        drawWeel(ctx, -WIDTH/2, HEIGHT/3, HEIGHT*(2/3));

        //HANDS
        drawHand(ctx, WIDTH/2, -HEIGHT/4, clip(walleRHA, -HEIGHT/6, HEIGHT/5), HEIGHT*(2/3)); // RIGHT
        drawHand(ctx, -WIDTH/2, -HEIGHT/4, clip(walleLHA, -HEIGHT/6, HEIGHT/5), HEIGHT*(2/3)); // LEFT
                                            // -------------^---^
                                            // Change clip to a function of height

        //EYES
        ctx.save();
            var eyeDistance = WIDTH/8
            var eyeHeight = HEIGHT*(7/6);
            ctx.lineWidth = eyeDistance*(4/3);
            drawLine(ctx, -eyeDistance, -eyeHeight, eyeDistance, -eyeHeight,DARKEST_GREY); //join the eyes
            drawRightEye(ctx, eyeDistance/2, -eyeHeight, clip(walleREA, -Math.PI/6, Math.PI/6), HEIGHT*(3/5));
            drawLeftEye(ctx, -eyeDistance/2, -eyeHeight, -clip(walleLEA, -Math.PI/6, Math.PI/6), HEIGHT*(3/5));
        ctx.restore();

        ctx.restore();
    };

})();
