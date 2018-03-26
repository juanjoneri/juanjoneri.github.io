$("#secret").hide();

function encrypt() {
    const N = $('#N-value').val();
    const e = $('#e-value').val();
    const text = stringNumber($('#text-value').val());

    const size = closestBinary(Math.floor(Math.log10(N)))
    const chunks = chunkString(text.toString(), size);
    console.log(chunks)

    let encrypted = []
    chunks.forEach((chunk) => {
        encrypted.push(modPower(chunk, e, N));
    });
    
    $('#output').val(encrypted);
}

function closestBinary(n) {
    while (n % 2 !== 0) {
        n--;
    }
    return n;
}

function calculatePublic() {
    $("#secret").show();
    const p = parseInt($('#p-value').val());
    const q = parseInt($('#q-value').val());
    
    N = p * q;
    const phi = (p-1) * (q-1);

    const e = randomPrime(N);
    d = modInverse(e, phi);

    $('#N-value').val(N);
    $('#e-value').val(e);

}

function decrypt() {
    const codeChunks = $('#text-value').val().split(",");
    let messageChunks = [];
    codeChunks.forEach((chunk) => {
        let value = parseInt(chunk);
        messageChunks.push(modPower(value, d, N));
    });
    msg = numberString(messageChunks);
    $('#output').val(msg);
}

function stringNumber(str) {
    let ans = ""
    for (let i = 0; i < str.length; i ++) {
        if (str.charCodeAt(i) === 32){
            ans += "99"; // treat spaces especially
        } else {
            ans += (str.charCodeAt(i) - 38).toString();
        }
    }
    return ans;
}

function numberString(nums) {
    let ans = ""
    nums.forEach((num) => {
        let str = num.toString();
        chunkString(str, 2).forEach((chunk) => {
            if (chunk === "99") {
                ans += " ";
            } else {
                ans += String.fromCharCode(parseInt(chunk) + 38);
            }
        });
    });
    return ans
}

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
