(() => {
    window.SampleSpriteLibrary = window.SampleSpriteLibrary || {};

    //Define color palete as constants
    const COLOR_BACKGROUND ='#bdbdbd';
    const COLOR_ACCENT = '#B71C1C';
    const BLACK = '#212121';
    const GREY = '#616161'

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

    SampleSpriteLibrary.clock = (clockSpecification) => {
        let ctx = clockSpecification.ctx;
        let COLOR_PRIMARY = clockSpecification.clockColor || '#607d8b';
        let clockX = clockSpecification.clockX || 0.0;
        let clockY = clockSpecification.clockY || 0.0;
        let clockR = clockSpecification.clockR || 50;
        let clockHr = clockSpecification.clockHr || 12;
        let clockMin = clockSpecification.clockMin || 30;
        let clockSec = clockSpecification.clockSec || 45;

        ctx.save();
            ctx.lineCap = 'round';
            ctx.translate(clockX, clockY);

            // OUTER AND INNER CIRCLES FOR BK
            drawCircle(ctx, 0, 0, clockR, COLOR_PRIMARY);
            drawCircle(ctx, 0, 0, (9/10)*clockR, COLOR_BACKGROUND);

            // HR HAND
            ctx.save();
                ctx.lineWidth = clockR/20;
                ctx.rotate(clockHr * (Math.PI / 6) + (Math.PI / 360) * clockMin + (Math.PI / 21600) *clockSec);
                let tip = -(6/12)*clockR;
                drawLine(ctx, 0, 0, 0, tip, BLACK);
            ctx.restore();

            // MIN HAND
            ctx.save();
                ctx.lineWidth = clockR/30;
                ctx.rotate((Math.PI / 30) * clockMin + (Math.PI / 1800) * clockSec);
                tip = -(9/12)*clockR;
                drawLine(ctx, 0, 0, 0, tip, BLACK)
            ctx.restore();

            // SEC HAND
            ctx.save();
                ctx.lineWidth = clockR/40;
                ctx.rotate(clockSec * Math.PI / 30);
                tip = -(1/2)*clockR;
                drawLine(ctx, 0, 0, 0, tip, COLOR_ACCENT);
                drawTriangle(ctx, -tip/10, tip, tip/10, tip, 0, tip + tip/5, COLOR_ACCENT);
            ctx.restore();

            // CIRCLE IN THE CENTER
            drawCircle(ctx, 0, 0, (1/20)*clockR, BLACK);

            //MARKINGS
            ctx.save();
                ctx.lineWidth = clockR/100;
                for (var ang = 0; ang < 60; ang ++) { //MIN markings
                    drawLine(ctx, 0, -(9/12)*clockR, 0, -(10/12)*clockR, GREY);
                    ctx.rotate(Math.PI/30);
                }
            ctx.restore();

            ctx.save();
                ctx.lineWidth = clockR/30;
                for (var ang = 0; ang < 12; ang ++) { //HRS markings
                    drawLine(ctx, 0, -(9/12)*clockR, 0, -(10/12)*clockR, BLACK);
                    ctx.rotate(Math.PI/6);
                }
            ctx.restore();
        ctx.restore();
    };

})();
