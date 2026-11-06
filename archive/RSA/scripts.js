







function chunkString(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

function modPower(a, b, c) {
    return bigInt(a).modPow(b, c);
}

function modInverse(x, m) {
    let [a, b, u] = [0, m, 1];
    let q = 0;
    while (x > 0) {
        q = Math.floor(b / x);
        [x, a, b, u] = [b % x, u, x, a - q * u];
    }
    if (b == 1) {
        let ans = a % m;
        if (ans < 0) {
            ans = m - ans;
        }
        return ans
    }
}

function isPrime(num) {
    for ( var i = 2; i < num; i++ ) {
        if ( num % i === 0 ) {
            return false;
        }
    }
    return true;
}

function randomPrime(max) {
    let range = max / 2
    let attempt = Math.floor(Math.random()*range + range);
    while (!isPrime(attempt)) {
        attempt = Math.floor(Math.random()*range + range);
    }
    return attempt;
}
