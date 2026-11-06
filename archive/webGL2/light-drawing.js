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
    p1.translate(1.0, 0, 0);
    let p2 = new Polygon().mySphere();
    p2.translate(-1.0, 0, 0);
    let p3 = new Polygon().myBox();
    p3.translate(0.0, 1.0, 0.0);
    let p4 = new Polygon().myBox();
    p4.translate(0.0, -1.0, 0.0);
    let p5 = new Polygon().myPyramid();
    p5.translate(0.0, 0.0, 1.0);
    let p6 = new Polygon().myPyramid();
    p6.translate(0.0, 0.0, -1.0);

    let group = new Polygon();
    group.addChild(p1);
    group.addChild(p2);
    group.addChild(p3);
    group.addChild(p4);
    group.addChild(p5);
    group.addChild(p6);

    let objectsToDraw = [
        {
            vertices: group.toRawTriangleArray(),

            // We will use our automatic color-array-generating code here.
            color: { r: 0.0, g: 1.0, b: 0.0 },

            // We make the specular reflection be white.
            specularColor: { r: 0.8, g: 1.0, b: 0.8 },
            shininess: 16,

            // Like colors, one normal per vertex. Now simplified with a helper function.
            normals: group.toNormalArray(),

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
        let modelViewM = m.rotate(0, 0, 0);
        modelViewM = object.rotation ?
        modelViewM.rotate(object.rotation.x, object.rotation.y, object.rotation.z) :
        modelViewM;

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
    let rotationAroundX = 560;
    let rotationAroundY = 425;
    let drawScene = () => {
        // Clear the display.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Set the overall rotation.
        rX = new Matrix();
        let rotationMX = rX.rotate(rotationAroundX, 0.0, 0.0);

        rY = new Matrix();
        let rotationMY = rY.rotate(0.0, rotationAroundY, 0.0);

        let m = new Matrix();
        let pos = new Matrix([500.0], [1000.0], [100.0], [1.0]);
        let rotationPos = m.rotate(-rotationAroundX, -rotationAroundY, 0.0);
        pos = rotationPos.multiply(pos);
        gl.uniform4fv(lightPosition, pos.flat);

        gl.uniformMatrix4fv(xRotationMatrix, gl.FALSE, new Float32Array(
            rotationMX.flat
        ));
        gl.uniformMatrix4fv(yRotationMatrix, gl.FALSE, new Float32Array(
            rotationMY.flat
        ));

        objectsToDraw.forEach(drawObject);

        // All done.
        gl.flush();
    };

    /*
     * Performs rotation calculations.
     */
    let xDragStart;
    let yDragStart;
    let xRotationStart;
    let yRotationStart;

    let rotateScene = (event) => {
        rotationAroundX = xRotationStart - yDragStart + event.clientY/100;
        rotationAroundY = yRotationStart - xDragStart + event.clientX/100;
        drawScene();
    };

    // Because our canvas element will not change size (in this program),
    // we can set up the projection matrix once, and leave it at that.
    // Note how this finally allows us to "see" a greater coordinate range.
    // We keep the vertical range fixed, but change the horizontal range
    // according to the aspect ratio of the canvas.  We can also expand
    // the z range now.
    m = new Matrix();
    let frustumM = m.frustum(5 * (canvas.width / canvas.height), -5 * (canvas.width / canvas.height), 5, -5, 5, -5);

    gl.uniformMatrix4fv(projectionMatrix, gl.FALSE, new Float32Array(frustumM.flat));

    m = new Matrix();
    let cameraM = m.gluLookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]); //default for frustum!

    gl.uniformMatrix4fv(cameraMatrix, gl.FALSE, new Float32Array(cameraM.flat));

    // Set up our one light source and its colors.
    gl.uniform4fv(lightPosition, [500.0, 1000.0, 100.0, 1.0]);
    gl.uniform3fv(lightDiffuse, [1.0, 1.0, 1.0]);
    gl.uniform3fv(lightSpecular, [1.0, 1.0, 1.0]);

    // Instead of animation, we do interaction: let the mouse control rotation.
    $(canvas).mousedown((event) => {
        xDragStart = event.clientX/100;
        yDragStart = event.clientY/100;
        xRotationStart = rotationAroundX;
        yRotationStart = rotationAroundY;
        $(canvas).mousemove(rotateScene);
    }).mouseup((event) => {
        $(canvas).unbind("mousemove");
    });

    // Draw the initial scene.
    drawScene();

})(document.getElementById("Lights"));
