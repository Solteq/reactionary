export async function jitter(duration: number, deviation: number) {
    const j = gaussianRandom(duration, deviation);
    
    return new Promise(resolve => setTimeout(resolve, j)); 
}


function gaussianRandom(mean: number, deviation: number) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

    return z * deviation + mean;
}