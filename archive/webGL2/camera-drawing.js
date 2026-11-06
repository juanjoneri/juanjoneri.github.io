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
    let p1 = new Polygon().myPyramid();

    let objectsToDraw = [

        {
            vertices: p1.toRawTriangleArray(),

            // We will use our automatic color-array-generating code here.
            color: { r: 0.0, g: 0.0, b: 1.0 },

            // We make the specular reflection be white.
            specularColor: { r: 0.8, g: 0.8, b: 1.8 },
            shininess: 16,

            // Like colors, one normal per vertex. Now simplified with a helper function.
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
    let xRotationMatrix = gl.getUniformLocation(shaderProgram, "xRotationMatrix");
    let yRotationMatrix = gl.getUniformLocation(shaderProgram, "yRotationMatrix");
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

        // Set up the model-view matrix, if an axis is included.  If not, we
        // specify the identity matrix.
        m = new Matrix();
        let modelViewM = m.scale(3, 3, 3);

        gl.uniformMatrix4fv(modelViewMatrix, gl.FALSE, new Float32Array(modelViewM.flat));

        // Set the varying normal vectors.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.normalBuffer);
        gl.vertexAttribPointer(normalVector, 3, gl.FLOAT, false, 0, 0);

        // Set the varying vertex coordinates.
        gl.bindBuffer(gl.ARRAY_BUFFER, object.vertexBuffer);
        gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(object.mode, 0, object.vertices.length / 3);
    };

    /*
     * Displays the scene.
     */
    lookingX = 0;
    lookingY = 0;
    lookingZ = 0;
    let drawScene = () => {
        // Clear the display.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // we do not want the object to rotate with the mouse so we apply id
        let m = new Matrix();

        gl.uniformMatrix4fv(xRotationMatrix, gl.FALSE, new Float32Array(
            m.flat
        ));
        gl.uniformMatrix4fv(yRotationMatrix, gl.FALSE, new Float32Array(
            m.flat
        ));

        $("#toptitle").text("[ " + lookingX.toFixed(1) + " " + lookingY.toFixed(1) + " " + lookingZ.toFixed(1) + " ]");
        m = new Matrix();     //  camera pos, looking at, up vector
        let cameraM = m.gluLookAt([lookingX, lookingY, lookingZ], [0, 0, -1], [0, 1, 0]);

        gl.uniformMatrix4fv(cameraMatrix, gl.FALSE, new Float32Array(cameraM.flat));

        objectsToDraw.forEach(drawObject);

        // All done.
        gl.flush();
    };

    /*
     * Performs rotation calculations.
     */


    // Because our canvas element will not change size (in this program),
    // we can set up the projection matrix once, and leave it at that.
    // Note how this finally allows us to "see" a greater coordinate range.
    // We keep the vertical range fixed, but change the horizontal range
    // according to the aspect ratio of the canvas.  We can also expand
    // the z range now.
    m = new Matrix();
    let v = 5;
    let frustumM = m.frustum(v * (canvas.width / canvas.height), -v * (canvas.width / canvas.height), v, -v, v, -v);

    gl.uniformMatrix4fv(projectionMatrix, gl.FALSE, new Float32Array(frustumM.flat));

    m = new Matrix();     //  camera pos, looking at, up vector
    let cameraM = m.gluLookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]);

    gl.uniformMatrix4fv(cameraMatrix, gl.FALSE, new Float32Array(cameraM.flat));

    // Set up our one light source and its colors.
    gl.uniform4fv(lightPosition, [500.0, 1000.0, 100.0, 1.0]);
    gl.uniform3fv(lightDiffuse, [1.0, 1.0, 1.0]);
    gl.uniform3fv(lightSpecular, [1.0, 1.0, 1.0]);

    var del = 0.03;

    $("#xp").click(function () {
        lookingX += del;
        drawScene();
    });
    $("#yp").click(function () {
        lookingY += del;
        drawScene();
    });
    $("#zp").click(function () {
        lookingZ += del;
        drawScene();
    });
    $("#xm").click(function () {
        lookingX -= del;
        drawScene();
    });
    $("#ym").click(function () {
        lookingY -= del;
        drawScene();
    });
    $("#zm").click(function () {
        lookingZ -= del;
        drawScene();
    });

    // Draw the initial scene.
    drawScene();

})(document.getElementById("Camera"));
