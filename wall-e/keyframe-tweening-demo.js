(() => {
    $.getJSON("scene.json").then((scene) => {
        let canvas = $("#canvas")[0];
        KeyframeTweener.initialize({
            renderingContext: canvas.getContext("2d"),
            width: canvas.width,
            height: canvas.height,
            scene: scene
        });
    });
})();
