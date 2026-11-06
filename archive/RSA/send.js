function encrypt() {
    const N = $('#N-value').val();
    const e = $('#e-value').val();
    const text = stringNumber($('#text-value').val());

    const size = closestBinary(Math.floor(Math.log10(N)))
    const chunks = chunkString(text.toString(), size);

    let encrypted = []
    chunks.forEach((chunk) => {
        encrypted.push(modPower(chunk, e, N));
    });
    
    $('#output').val(encrypted);
}


function closestBinary(n) {
    if (n % 2 !== 0) {
        n--;
    }
    return n;
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


function chunkString(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

function modPower(a, b, c) {
    return bigInt(a).modPow(b, c);
}