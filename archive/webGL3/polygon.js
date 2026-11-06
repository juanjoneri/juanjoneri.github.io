/*
    This class should be used to create polygons
    the instance will turn into an instance of a specific polygon when the
    method is called
    the rawTriangleArray of that shape will be returned upon creation
    however the properties will be stored in the instance
    and one can call to Rawline array if prefered over to raw triangle array
*/

window.Polygon = (function () {

    // Define the class.
    return class Polygon {
        constructor() {
            // This class only has static functions
            this.vertices = [];
            this.indices = [];
            this.indexedVertices = { vertices: this.vertices, indices: this.indices };

            this.index = 0; // for the sphere
        }

        addChild(child) {
            // concat vertices arrays
            // concat incices, but add the length of this vertices to seccond indices array
            var verticesUnion = this.vertices.concat(child.vertices);
            for (var i = 0; i < child.indices.length; i ++) {
                for (var j = 0; j < 3; j ++) {
                    child.indices[i][j] += this.vertices.length;
                }
            }
            var indicesUnion = this.indices.concat(child.indices);

            this.indices = indicesUnion;
            this.vertices = verticesUnion;
        }

        toRawTriangleArray() {
            this.indexedVertices = { vertices: this.vertices, indices: this.indices };
            let result = [];

            for (let i = 0, maxi = this.indexedVertices.indices.length; i < maxi; i += 1) {
                for (let j = 0, maxj = this.indexedVertices.indices[i].length; j < maxj; j += 1) {
                    result = result.concat(
                        this.indexedVertices.vertices[
                            this.indexedVertices.indices[i][j]
                        ]
                    );
                }
            }
            return result;
        }

        toRawLineArray() {
            this.indexedVertices = { vertices: this.vertices, indices: this.indices };
            let result = [];

            for (let i = 0, maxi = this.indexedVertices.indices.length; i < maxi; i += 1) {
                for (let j = 0, maxj = this.indexedVertices.indices[i].length; j < maxj; j += 1) {
                    result = result.concat(
                        this.indexedVertices.vertices[
                            this.indexedVertices.indices[i][j]
                        ],

                        this.indexedVertices.vertices[
                            this.indexedVertices.indices[i][(j + 1) % maxj]
                        ]
                    );
                }
            }

            return result;
        }

        toVertexNormalArray() {
            this.indexedVertices = { vertices: this.vertices, indices: this.indices };
            let result = [];

            // For each face...
            for (let i = 0, maxi = indexedVertices.indices.length; i < maxi; i += 1) {
                // For each vertex in that face...
                for (let j = 0, maxj = indexedVertices.indices[i].length; j < maxj; j += 1) {
                    let p = indexedVertices.vertices[indexedVertices.indices[i][j]];
                    let normal = new Vector(p[0], p[1], p[2]).unit;
                    result = result.concat(
                        [ normal.x, normal.y, normal.z ]
                    );
                }
            }

            return result;
        }

        toNormalArray() {
            this.indexedVertices = { vertices: this.vertices, indices: this.indices };
            let result = [];

            // For each face...
            for (let i = 0, maxi = this.indexedVertices.indices.length; i < maxi; i += 1) {
                // We form vectors from the first and second then second and third vertices.
                let p0 = this.indexedVertices.vertices[this.indexedVertices.indices[i][0]];
                let p1 = this.indexedVertices.vertices[this.indexedVertices.indices[i][1]];
                let p2 = this.indexedVertices.vertices[this.indexedVertices.indices[i][2]];

                // Technically, the first value is not a vector, but v can stand for vertex
                // anyway, so...
                let v0 = new Vector(p0[0], p0[1], p0[2]);
                let v1 = new Vector(p1[0], p1[1], p1[2]).subtract(v0);
                let v2 = new Vector(p2[0], p2[1], p2[2]).subtract(v0);
                let normal = v1.cross(v2).unit;

                // We then use this same normal for every vertex in this face.
                for (let j = 0, maxj = this.indexedVertices.indices[i].length; j < maxj; j += 1) {
                    result = result.concat(
                        [ normal.x, normal.y, normal.z ]
                    );
                }
            }

            return result;
        };

        myIcosahedron(lines) {
            // The core icosahedron coordinates.
            const X = 0.525731112119133606/5;
            const Z = 0.850650808352039932/5;

            this.vertices = [
                    [ -X, 0.0, Z ],
                    [ X, 0.0, Z ],
                    [ -X, 0.0, -Z ],
                    [ X, 0.0, -Z ],
                    [ 0.0, Z, X ],
                    [ 0.0, Z, -X ],
                    [ 0.0, -Z, X ],
                    [ 0.0, -Z, -X ],
                    [ Z, X, 0.0 ],
                    [ -Z, X, 0.0 ],
                    [ Z, -X, 0.0 ],
                    [ -Z, -X, 0.0 ]
            ];

            this.indices = [
                    [ 1, 4, 0 ],
                    [ 4, 9, 0 ],
                    [ 4, 5, 9 ],
                    [ 8, 5, 4 ],
                    [ 1, 8, 4 ],
                    [ 1, 10, 8 ],
                    [ 10, 3, 8 ],
                    [ 8, 3, 5 ],
                    [ 3, 2, 5 ],
                    [ 3, 7, 2 ],
                    [ 3, 10, 7 ],
                    [ 10, 6, 7 ],
                    [ 6, 11, 7 ],
                    [ 6, 0, 11 ],
                    [ 6, 1, 0 ],
                    [ 10, 1, 6 ],
                    [ 11, 0, 9 ],
                    [ 2, 11, 9 ],
                    [ 5, 2, 9 ],
                    [ 11, 2, 7 ]
                ];

            return this;
        }



        myBox() {
            const l = 0.5;

            this.vertices = [
                    [ l, l, l ],
                    [ l, l, -l ],
                    [ l, -l, l ],
                    [ l, -l, -l ],

                    [ -l, l, l ],
                    [ -l, l, -l ],
                    [ -l, -l, l ],
                    [ -l, -l, -l ]];

            this.indices = [
                    [ 0, 2, 3 ],
                    [ 0, 3, 1 ],

                    [ 6, 0, 4 ],
                    [ 6, 2, 0 ],

                    [ 0, 1, 5 ],
                    [ 0, 5, 4 ],

                    [ 3, 7, 5 ],
                    [ 3, 5, 1 ],

                    [ 6, 4, 5 ],
                    [ 6, 5, 7 ],

                    [ 2, 6, 7 ],
                    [ 2, 7, 3 ]];

            return this;
        }



        myPyramid() {
            const l = 0.5;

            this.vertices = [
                    [ l, 0, l ],
                    [ l, 0, -l ],
                    [ -l, 0, -l ],
                    [ -l, 0, l ],
                    [ 0, l, 0 ]];

            this.indices = [
                    [ 0, 3, 2 ],
                    [ 0, 2, 1 ],

                    [ 0, 1, 4 ],
                    [ 1, 2, 4 ],
                    [ 2, 3, 4 ],
                    [ 3, 0, 4 ]];

            return this;
        }

        // Sphere section
        addVertex(x, y, z) {
            var l = 0.5;
            var length = Math.sqrt(x * x + y * y + z * z) / l;
            this.vertices.push([x / length, y / length, z / length]);
            return this.index ++;
        }

        getMiddlePoint(p1, p2) {
            var point1 = this.vertices[p1];
            var point2 = this.vertices[p2];
            var middle = [
                (point1[0] + point2[0]) / 2.0,
                (point1[1] + point2[1]) / 2.0,
                (point1[2] + point2[2]) / 2.0 ];

            // find the middle point and add it to our existing vertices
            return this.addVertex(middle[0], middle[1], middle[2]);
        }

        mySphere(lines) {
            const t = (1.0 + Math.sqrt(5.0)) / 2.0;
            const recursionLevel = 2;

            this.vertices = [];
            this.addVertex(-1, t, 0);
            this.addVertex(1, t, 0);
            this.addVertex(-1, -t, 0);
            this.addVertex(1, -t, 0);

            this.addVertex(0, -1, t);
            this.addVertex(0, 1, t);
            this.addVertex(0, -1, -t);
            this.addVertex(0, 1, -t);

            this.addVertex(t, 0, -1);
            this.addVertex(t, 0, 1);
            this.addVertex(-t, 0, -1);
            this.addVertex(-t, 0, 1);

            this.indices = [
                [ 0, 11, 5 ],
                [ 0, 5, 1 ],
                [ 0, 1, 7 ],
                [ 0, 7, 10 ],
                [ 0, 10, 11 ],

                [ 1, 5, 9 ],
                [ 5, 11, 4 ],
                [ 11, 10, 2 ],
                [ 10, 7, 6 ],
                [ 7, 1, 8 ],

                [ 3, 9, 4 ],
                [ 3, 4, 2 ],
                [ 3, 2, 6 ],
                [ 3, 6, 8 ],
                [ 3, 8, 9 ],

                [ 4, 9, 5 ],
                [ 2, 4, 11 ],
                [ 6, 2, 10 ],
                [ 8, 6, 7 ],
                [ 9, 8, 1 ]];

            for (let i = 0; i < recursionLevel; i++) {
                var indices2 = [];
                for (let i = 0; i < this.indices.length; i++) {
                    var tri = this.indices[i];

                    var a = this.getMiddlePoint(tri[0], tri[1]);
                    var b = this.getMiddlePoint(tri[1], tri[2]);
                    var c = this.getMiddlePoint(tri[2], tri[0]);

                    indices2.push([tri[0], a, c]);
                    indices2.push([tri[1], b, a]);
                    indices2.push([tri[2], c, b]);
                    indices2.push([a, b, c]);
                }
                this.indices = indices2;
            }

            return this;
        }

        translate (x, y, z) {
            this.vertices.forEach(function(vertex) {
                vertex[0] += x;
                vertex[1] += y;
                vertex[2] += z;
            });
        }

    };
})();
