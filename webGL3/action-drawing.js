/*
 * For maximum modularity, we place everything within a single function that
 * takes the canvas that it will need.
 */
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
    let p1 = new Polygon().mySphere();

    let objectsToDraw = [

        {
            vertices: p1.toRawTriangleArray(),
            color: { r: 0.0, g: 0.0, b: 1.0 },
            specularColor: { r: 0.8, g: 0.8, b: 1.8 },
            shininess: 16,
            normals: p1.toNormalArray(),
            mode: gl.TRIANGLES
        }
    ];

    // Pass the vertices to WebGL.
    objectsToDraw.forEach((objectToDraw) => {
        objectToDraw.vertexBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.vertices);

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

        // Same trick with specular colors.
        if (!objectToDraw.specularColors) {
            // Future refactor: helper function to convert a single value or
            // array into an array of copies of itself.
            objectToDraw.specularColors = [];
            for (let j = 0, maxj = objectToDraw.vertices.length / 3; j < maxj; j += 1) {
                objectToDraw.specularColors = objectToDraw.specularColors.concat(
                    objectToDraw.specularColor.r,
                    objectToDraw.specularColor.g,
                    objectToDraw.specularColor.b
                );
            }
        }
        objectToDraw.specularBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.specularColors);

        // One more buffer: normals.
        objectToDraw.normalBuffer = GLSLUtilities.initVertexBuffer(gl, objectToDraw.normals);
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
    let vertexDiffuseColor = gl.getAttribLocation(shaderProgram, "vertexDiffuseColor");
    gl.enableVertexAttribArray(vertexDiffuseColor);
    let vertexSpecularColor = gl.getAttribLocation(shaderProgram, "vertexSpecularColor");
    gl.enableVertexAttribArray(vertexSpecularColor);
    let normalVector = gl.getAttribLocation(shaderProgram, "normalVector");
    gl.enableVertexAttribArray(normalVector);

    // Finally, we come to the typical setup for transformation matrices:
    // model-view and projection, managed separately.
    let modelViewMatrix = gl.getUniformLocation(shaderProgram, "modelViewMatrix");
    let projectionMatrix = gl.getUniformLocation(shaderProgram, "projectionMatrix");
    let cameraMatrix = gl.getUniformLocation(shaderProgram, "cameraMatrix");

    // Note the additional variables.
    let lightPosition = gl.getUniformLocation(shaderProgram, "lightPosition");
    let lightDiffuse = gl.getUniformLocation(shaderProgram, "lightDiffuse");
    let lightSpecular = gl.getUniformLocation(shaderProgram, "lightSpecular");
    let shininess = gl.getUniformLocation(shaderProgram, "shininess");

    /*
     * Displays an individual object, including a transformation that now varies
     * for each object drawn.
     */
    let drawObject = (object) => {
        // Set the varying colors.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.colorBuffer);
        gl.vertexAttribPointer(vertexDiffuseColor, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, object.specularBuffer);
        gl.vertexAttribPointer(vertexSpecularColor, 3, gl.FLOAT, false, 0, 0);

        // Set the shininess.
        gl.uniform1f(shininess, object.shininess);

        // Set the varying normal vectors.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.normalBuffer);
        gl.vertexAttribPointer(normalVector, 3, gl.FLOAT, false, 0, 0);

        // Set the varying vertex coordinates.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vertexBuffer);
        gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(object.mode, 0, object.vertices.length / 3);
    };

    let drawScene = () => {
        // Clear the display.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let m = new Matrix();
        let rotationM = m.rotate(rotation, 0, 0);

        // rotate the light so that it stays put
        m = new Matrix();
        let pos = new Matrix([500.0], [1000.0], [100.0], [1.0]);
        let rotationPos = m.rotate(-rotation, 0.0, 0.0);
        pos = rotationPos.multiply(pos);
        gl.uniform4fv(lightPosition, pos.flat);

        // change scaling when bouncing
        m = new Matrix();
        let scalingM = m.scale(2, 2, 2);
        m = new Matrix();
        let translationM = m.translate(0, position, 0);

        let modelViewM = rotationM.multiply(scalingM);
        modelViewM = translationM.multiply(modelViewM);
        gl.uniformMatrix4fv(modelViewMatrix, gl.FALSE, new Float32Array(modelViewM.flat));

        m = new Matrix();     //  camera pos, looking at, up vector
        let cameraM = m.gluLookAt([Math.sin(t/40), 3, Math.cos(t/40)], [-Math.sin(t/40), 2, -Math.cos(t/40)], [0, 1, 0]);
        gl.uniformMatrix4fv(cameraMatrix, gl.FALSE, new Float32Array(cameraM.flat));

        let side = 10;
        m = new Matrix();
        let frustumM = m.frustum(side * (canvas.width / canvas.height), -side * (canvas.width / canvas.height), side, -side, 10, -10);
        gl.uniformMatrix4fv(projectionMatrix, gl.FALSE, new Float32Array(frustumM.flat));

        // Display the objects.
        objectsToDraw.forEach(drawObject);
        // All done.
        gl.flush();
    };

    // Set up our one light source and its colors.
    gl.uniform4fv(lightPosition, [500.0, 1000.0, 100.0, 1.0]);
    gl.uniform3fv(lightDiffuse, [1.0, 1.0, 1.0]);
    gl.uniform3fv(lightSpecular, [1.0, 1.0, 1.0]);

    /*
     * Animates the scene.
     */
    let animationActive = true;
    let currentRotation = 0.0;
    let previousTimestamp = null;

    const FRAMES_PER_SECOND = 20;
    const MILLISECONDS_PER_FRAME = 1000 / FRAMES_PER_SECOND;

    // ANIMATION VARIABLES

    var t = 0;

    var dx = 0
    var dr = 0;

    var g = -0.15;
    var drag = 0.02;

    var rotation = 0;
    var position = 0;

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
            t ++;
            window.requestAnimationFrame(advanceScene);
            return;
        }

        dr -= (drag * dr);
        if (dr < 0.01)
            dr = 0;
        rotation += dr;

        if (dx !== 0) dx += g;
        position += dx;
        if (position < 0) {
            if (Math.abs(dx) < 0.01) {
                position = 0;
                dx = 0;
                dr /= 4;
            }
            dx = Math.abs(dx);
        }
        drawScene();

        // Request the next frame.
        previousTimestamp = timestamp;
        window.requestAnimationFrame(advanceScene);
    };

    // Draw the initial scene.
    drawScene();
    window.requestAnimationFrame(advanceScene);

    $(canvas).click(() => {
        dx = 1.5;
        dr = 1.5;
    });

})(document.getElementById("Action"));
