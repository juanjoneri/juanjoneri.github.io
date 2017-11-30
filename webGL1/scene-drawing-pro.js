var parent = new Polygon();
parent.mySphere();
var child = new Polygon();
child.myBox();
parent.addChild(child);


canvases = [

//  [canvas name, shape, colors, rotation del, scaling del, translation del]

    ["canvas11", new Polygon().myBox(), { r: 1.0, g: 0.0, b: 0.0 }, [0.01, 0.01, 0], [0, 0, 0], [0, 0, 0]],
    ["canvas12", new Polygon().myPyramid(), { r: 0.0, g: 1.0, b: 0.0 }, [0, 0.01, 0.01], [0, 0, 0], [0, 0, 0]],
    ["canvas13", new Polygon().mySphere(), { r: 0.0, g: 0.0, b: 1.0 }, [0.01, 0, 0.01], [0, 0, 0], [0, 0, 0]],

    ["canvas21", new Polygon().myBox(), { r: 1.0, g: 0.0, b: 0.0 }, [0, 0, 0], [0.005, 0.005, 0], [0, 0, 0]],
    ["canvas22", new Polygon().myPyramid(), { r: 0.0, g: 1.0, b: 0.0 }, [0, 0, 0], [0, 0.005, 0.005], [0, 0, 0]],
    ["canvas23", new Polygon().mySphere(), { r: 0.0, g: 0.0, b: 1.0 }, [0, 0, 0], [0.005, 0, 0.005], [0, 0, 0]],

    ["canvas31", new Polygon().myBox(), { r: 1.0, g: 0.0, b: 0.0 }, [0, 0, 0], [0, 0, 0], [0.01, 0.01, 0]],
    ["canvas32", new Polygon().myPyramid(), { r: 0.0, g: 1.0, b: 0.0 }, [0, 0, 0], [0, 0, 0], [0, 0.01, 0.01]],
    ["canvas33", new Polygon().mySphere(), { r: 0.0, g: 0.0, b: 1.0 }, [0, 0, 0], [0, 0, 0], [0.01, 0, 0.01]],

    ["canvas4", parent.toRawLineArray(), { r: 0.0, g: 0.0, b: 1.0 }, [0.01, -0.01, 0.01], [0.0001, 0.0001, -0.0001], [-0.0005, 0.0001, 0.0005]]
];

canvases.forEach ( function(specs) {

((canvas) => {

    // Grab the WebGL rendering context.
    let gl = GLSLUtilities.getGL(canvas);
    if (!gl) {
        alert("No WebGL context found...sorry.");

        // No WebGL, no use going on...
        return;
    }

    // Set up settings that will not change.  This is not "canned" into a
    // utility function because these settings really can vary from program
    // to program.
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Build the objects to display.
    let objectsToDraw = [

        {
            color: specs[2],
            vertices: specs[1],
            mode: gl.LINES
        }
    ];

    // Pass the vertices to WebGL.
    objectsToDraw.forEach((objectToDraw) => {
        objectToDraw.buffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.vertices);

        if (!objectToDraw.colors) {
            // If we have a single color, we expand that into an array
            // of the same color over and over.
            objectToDraw.colors = [];
            for (let i = 0, maxi = objectToDraw.vertices.length / 3; i < maxi; i += 1) {
                objectToDraw.colors = objectToDraw.colors.concat(
                    objectToDraw.color.r,
                    objectToDraw.color.g,
                    objectToDraw.color.b
                );
            }
        }

        objectToDraw.colorBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.colors);
    });

    // Initialize the shaders.
    let abort = false;
    let shaderProgram = GLSLUtilities.initSimpleShaderProgram(
        gl,
        $("#vertex-shader").text(),
        $("#fragment-shader").text(),

        // Very cursory error-checking here...
        (shader) => {
            abort = true;
            alert("Shader problem: " + gl.getShaderInfoLog(shader));
        },

        // Another simplistic error check: we don't even access the faulty
        // shader program.
        (shaderProgram) => {
            abort = true;
            alert("Could not link shaders...sorry.");
        }
    );

    // If the abort variable is true here, we can't continue.
    if (abort) {
        alert("Fatal errors encountered; we cannot continue.");
        return;
    }

    // All done --- tell WebGL to use the shader program from now on.
    gl.useProgram(shaderProgram);

    // Hold on to the important variables within the shaders.
    let vertexPosition = gl.getAttribLocation(shaderProgram, "vertexPosition");
    gl.enableVertexAttribArray(vertexPosition);
    let vertexColor = gl.getAttribLocation(shaderProgram, "vertexColor");
    gl.enableVertexAttribArray(vertexColor);
    let transformationMatrix = gl.getUniformLocation(shaderProgram, "transformationMatrix");

    /*
     * Displays an individual object.
     */
    let drawObject = (object) => {
        // Set the varying colors.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.colorBuffer);
        gl.vertexAttribPointer(vertexColor, 3, gl.FLOAT, false, 0, 0);

        // Set the varying vertex coordinates.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.buffer);
        gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(object.mode, 0, object.vertices.length / 3);
    };

    /*
     * Displays the scene.
     */
    // Initialize all shapes to not rotate, scale, or translate
    let initCondit = [[0, 0, 0], [1, 1, 1], [0, 0, 0]];
    let currentCondit = [[0, 0, 0], [1, 1, 1], [0, 0, 0]];
    let endCondit = [[1000, 1000, 1000], [1.1, 1.1, 1.1], [0.7, 0.7, 0.7]];


    let drawScene = () => {
        // Clear the display.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Set up the rotation matrix.
        let m = new Matrix(); // make an id matrix
        let rotationM = m.rotate(currentCondit[0][0], currentCondit[0][1], currentCondit[0][2]);
        m = new Matrix();
        let scalingM = m.scale(currentCondit[1][0], currentCondit[1][1], currentCondit[1][2]);
        m = new Matrix();
        let translationM = m.translate(currentCondit[2][0], currentCondit[2][1], currentCondit[2][2]);

        m = new Matrix();
        let frustumM = m.frustum(2 * (canvas.width / canvas.height), -2 * (canvas.width / canvas.height), 2, -2, 10, -10);

        let transformationM = rotationM.multiply(scalingM);
        transformationM = translationM.multiply(transformationM);
        transformationM = frustumM.multiply(transformationM);

        gl.uniformMatrix4fv(transformationMatrix, gl.FALSE, new Float32Array(transformationM.flat));

        // Display the objects.
        objectsToDraw.forEach(drawObject);

        // All done.
        gl.flush();
    };

    /*
     * Animates the scene.
     */
    let animationActive = false;
    let currentRotation = 0.0;
    let previousTimestamp = null;

    const FRAMES_PER_SECOND = 60;
    const MILLISECONDS_PER_FRAME = 1000 / FRAMES_PER_SECOND;

    const FULL_CIRCLE = 2*Math.PI;
    const DEGREES_PER_MILLISECOND = FULL_CIRCLE / 10000;

    let advanceScene = (timestamp) => {
        // Check if the user has turned things off.
        if (!animationActive) {
            return;
        }

        // Initialize the timestamp.
        if (!previousTimestamp) {
            previousTimestamp = timestamp;
            window.requestAnimationFrame(advanceScene);
            return;
        }

        // Check if it's time to advance.
        var progress = timestamp - previousTimestamp;
        if (progress < MILLISECONDS_PER_FRAME) {
            // Do nothing if it's too soon.
            window.requestAnimationFrame(advanceScene);
            return;
        }

        // All clear.
        for (let i = 0; i < 3; i ++) {
            for (let j = 0; j < 3; j ++) {
                currentCondit[i][j] += specs[i + 3][j];
            }
        }
        drawScene();

        // Request the next frame.
        previousTimestamp = timestamp;
        window.requestAnimationFrame(advanceScene);
    };

    // Draw the initial scene.
    drawScene();

    // Set up the rotation toggle: clicking on the canvas does it.
    $(canvas).click(() => {
        animationActive = !animationActive;
        if (animationActive) {
            previousTimestamp = null;
            window.requestAnimationFrame(advanceScene);
        }
    });

})(document.getElementById(specs[0]));

});
