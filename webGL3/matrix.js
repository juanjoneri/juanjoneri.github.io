/*
 * This JavaScript file defines a Matrix object and associated functions.
 * The object itself is returned as the result of a function, allowing us
 * to encapsulate its code and module variables.
 *
 * This module's approach is non-destructive: methods always return new
 * Matrix objects, and never modify the operands. This is a design choice.
 *
 * This module is designed for Matrixs of any number of dimensions.  The
 * implementations are generalized but not optimal for certain sizes of
 * Matrices.
 */
window.Matrix = (function () {
    // A private method for checking commutability of the matrices,
    // throwing an exception when not.
    let checkCommutability = (m1, m2) => {
        if (m1.dimensions[1] !== m2.dimensions[0]) {
            throw "Matrices are not commutable";
        }
    };

    let checkAdditability = (m1, m2) => {
        if (m1.dimensions[0] !== m2.dimensions[0] || m1.dimensions[1] !== m2.dimensions[1]) {
            throw "Matrices are not addable";
        }
    };

    let check3D = (m) => {
        // check to see if this is not a vector or the id matrix...

        // is it an id matrix ?
        if (m.dimensions[0] === 4 && m.dimensions[1] === 4) {
            if (m.elements[0][0] !== 1 || m.elements[1][1] !== 1 || m.elements[2][2] !== 1 || m.elements[3][3] !== 1) {
                throw "This matrix does not represent an identity matrix";
            }
        } else {
            // is it a vector ?
            if (m.dimensions[0] !== 4 || m.dimensions[1] !== 1) {
                throw "This matrix does not represent a 3d object and cannot be rotated or translated (not 4d vector)";
            }
            if (m.elements[3][0] !== 1) {
                throw "This matrix does not represent a 3d object and cannot be rotated or translated (las dimension != 1)";
            }
        }

    };

    // Define the class.
    return class Matrix {
        constructor() {
            // expect --> new Matrix([1, 2, 3], [4, 5, 6], [7, 8, 9]);
            var rows = [].slice.call(arguments);

            if (rows.length > 0) {
                var width = rows[0].length;
                rows.forEach(function(row) {
                    if (row.length !== width) {
                        throw "Incorrect dimensions";
                    }
                });
                this.elements = rows;
            } else {
                this.elements = [[1, 0, 0, 0],
                                [0, 1, 0, 0],
                                [0, 0, 1, 0],
                                [0, 0, 0, 1]];
            }

        }

        get dimensions() {
            var nbRows = this.elements.length;
            var nbColumns = 1;

            if (nbRows === 0) {
                nbColumns = 0;
            } else if (nbRows > 0) {
                nbColumns = this.elements[0].length;
            }
            return [nbRows, nbColumns];
            // [nb rows, nb columns]
        }

        get flat() {
            return [].concat.apply([], this.elements);
        }

        row(r) {
            if (this.dimensions[0] > r) {
                return this.elements[r];
            } else {
                throw "not enough rows in matrix";
            }
        }

        col(c) {
            if (this.dimensions[1] > c) {
                var result = [];
                for (let i = 0; i < this.dimensions[0]; i++) {
                    result.push(this.elements[i][c]);
                }
                return result;
            } else {
                throw "not enough columns in matrix";
            }
        }


        add(m) {
            let result = new Matrix();
            result.elements = [];

            checkAdditability(this, m);

            for (let i = 0, max = this.dimensions[0]; i < max; i += 1) {
                var currentRow = [];
                for (let j = 0, max = this.dimensions[1]; j < max; j += 1) {
                    currentRow.push(this.elements[i][j] + m.elements[i][j]);
                }
                result.elements.push(currentRow);
            }

            return result;
        }

        subtract(m) {
            let result = new Matrix();
            result.elements = [];

            checkAdditability(this, m);

            for (let i = 0, max = this.dimensions[0]; i < max; i += 1) {
                var currentRow = [];
                for (let j = 0, max = this.dimensions[1]; j < max; j += 1) {
                    currentRow.push(this.elements[i][j] - m.elements[i][j]);
                }
                result.elements.push(currentRow);
            }

            return result;
        }

        dot(row, col) {
            // A method for multiplyin vectors should be static
            if (row.length !== col.length) {
                throw "Incorrect dimensions";
            }
            var result = 0;
            for (let i = 0; i < row.length; i++) {
                result += row[i] * col[i];
            }
            return result;
        }

        multiply(m) {
            let result = new Matrix();
            result.elements = [];

            checkCommutability(this, m);

            var newDim = [this.dimensions[0], m.dimensions[1]];
            for (let i = 0; i < newDim[0]; i++) {
                var newRow = [];
                var thisRow = this.row(i);
                for (let j = 0; j < newDim[1]; j++) {
                    var thisCol = m.col(j);
                    newRow.push(this.dot(thisRow, thisCol));
                }
                result.elements.push(newRow);
            }

            return result;
        }

        scalar(s) {
            let result = new Matrix();
            result.elements = [];

            for (let i = 0, max = this.dimensions[0]; i < max; i += 1) {
                var currentRow = [];
                for (let j = 0, max = this.dimensions[1]; j < max; j += 1) {
                    currentRow.push(this.elements[i][j] * s);
                }
                result.elements.push(currentRow);
            }

            return result;
        }

        rotate(aX, aY, aZ) {
            check3D(this);
            // Rotate a matrix a certain angle a = {aX, aY, aZ}

            let Rx = new Matrix();
            let Ry = new Matrix();
            let Rz = new Matrix();

            if (aX !== 0) {
                Rx = new Matrix(
                    [1, 0, 0, 0],
                    [0, Math.cos(aX), -Math.sin(aX), 0],
                    [0, Math.sin(aX), Math.cos(aX), 0],
                    [0, 0, 0, 1]
                );
            }

            if (aY !== 0) {
                Ry = new Matrix(
                    [Math.cos(aY), 0, Math.sin(aY), 0],
                    [0, 1, 0, 0],
                    [-Math.sin(aY), 0, Math.cos(aY), 0],
                    [0, 0, 0, 1]
                );
            }

            if (aZ !== 0) {
                Rz = new Matrix(
                    [Math.cos(aZ), -Math.sin(aZ), 0, 0],
                    [Math.sin(aZ), Math.cos(aZ), 0, 0],
                    [0, 0, 1, 0],
                    [0, 0, 0, 1]
                );
            }

            return Rz.multiply(Ry.multiply(Rx.multiply(this)));
        }

        scale(aX, aY, aZ) {
            check3D(this);
            // Scale a vector a certain factor a = {aX, aY, aZ}

            let T = new Matrix(
                [aX, 0, 0, 0],
                [0, aY, 0, 0],
                [0, 0, aZ, 0],
                [0, 0, 0, 1]
            );

            return T.multiply(this);
        }

        unit() {
            let magnitude = Math.sqrt(m.elements[0][0]*m.elements[0][0] + m.elements[0][1]*m.elements[0][1] + m.elements[0][2]*m.elements[0][2]);
            this.scale(1/magnitude);
            this.elements[0][3] = 1;
            return this;
        }

        translate(aX, aY, aZ) {
            check3D(this);
            // Translate a vector a certain factor a = {aX, aY, aZ}
            let T = new Matrix(
                [1, 0, 0, aX],
                [0, 1, 0, aY],
                [0, 0, 1, aZ],
                [0, 0, 0, 1]
            );

            return T.multiply(this);
        }

        project(axis) {
            check3D(this);
            // choose axis x, y or z to project the point into
            var x = axis === "x" ? 0 : 1;
            var y = axis === "y" ? 0 : 1;
            var z = axis === "z" ? 0 : 1;

            let T = new Matrix(
                [x, 0, 0, 0],
                [0, y, 0, 0],
                [0, 0, z, 0],
                [0, 0, 0, 1]
            );

            return T.multiply(this);
        }

        projection(v) {
            v.unit();
            return v.scalar(this.dot(v));
        }

        frustum(R, L, T, B, F, N) {
            check3D(this);

            let M = new Matrix(
                [2 / (R - L), 0, 0, -(R + L) / (R - L)],
                [0, 2 / (T - B), 0, -(T + B) / (T - B)],
                [0, 0, -2 / (F - N), -(F + N) / (F - N)],
                [0, 0, 0, 1]
            );

            return M.multiply(this);
        }

        gluLookAt(p, q, u) {
            let P = new Vector(p[0], p[1], p[2]);
            let Q = new Vector(q[0], q[1], q[2]);
            let U = new Vector(u[0], u[1], u[2]);

            let Ze = P.subtract(Q);
            Ze = Ze.unit;

            let projZ = U.projection(Ze);
            let Ye = U.subtract(projZ);
            Ye = Ye.unit;

            let Xe = Ye.cross(Ze);

            let M = new Matrix(
                [Xe.x, Xe.y, Xe.z, -P.dot(Xe)],
                [Ye.x, Ye.y, Ye.z, -P.dot(Ye)],
                [Ze.x, Ze.y, Ze.z, -P.dot(Ze)],
                [0, 0, 0, 1]
            );

            return M.multiply(this);
        }
    };
})();
