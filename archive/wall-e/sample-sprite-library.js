(() => {
    window.SampleSpriteLibrary = window.SampleSpriteLibrary || {};

    var bootImage = new Image();
    bootImage.src = './bootImage.png';

    SampleSpriteLibrary.square = ({ ctx, tx, ty }) => {
        ctx.save();
            ctx.translate(tx, ty);
            ctx.fillStyle = "blue";
            ctx.fillRect(-20, -20, 40, 40);
        ctx.restore();
    };

    SampleSpriteLibrary.circle = ({ ctx, tx, ty }) => {
        ctx.save();
            ctx.translate(tx, ty);
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.stroke();
        ctx.restore();
    };

    SampleSpriteLibrary.boot = ({ ctx, tx, ty }) => {
        ctx.save();
            ctx.translate(tx, ty);
            ctx.scale(0.4, 0.4); //because the image is too big
            ctx.drawImage(bootImage, 0, 0);
        ctx.restore();


    };

})();
