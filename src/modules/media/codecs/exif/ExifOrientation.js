/**
 * ExifOrientation — apply EXIF orientation correction to canvas via
 * 2D context transforms.
 *
 * EXIF orientation values:
 *   1 = normal (no transform)
 *   2 = flip horizontal
 *   3 = rotate 180
 *   4 = flip vertical
 *   5 = rotate 90 CW + flip horizontal
 *   6 = rotate 90 CW
 *   7 = rotate 90 CCW + flip horizontal
 *   8 = rotate 90 CCW
 *
 * @param {OffscreenCanvas|HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} orientation 1–8
 * @param {number} width  original image width
 * @param {number} height original image height
 * @returns {{ canvas, ctx, width, height }} — may swap width/height for 90° rotations
 */
export function applyOrientation(canvas, ctx, orientation, width, height) {
    if (orientation === 1) return { canvas, ctx, width, height };

    // Orientations 5–8 involve 90° rotation → swap dimensions
    const rotated = orientation >= 5;
    const outW = rotated ? height : width;
    const outH = rotated ? width : height;

    canvas.width = outW;
    canvas.height = outH;

    ctx.save();

    // Build transform based on orientation
    switch (orientation) {
        case 2:
            ctx.translate(outW, 0);
            ctx.scale(-1, 1);
            break;
        case 3:
            ctx.translate(outW, outH);
            ctx.rotate(Math.PI);
            break;
        case 4:
            ctx.translate(0, outH);
            ctx.scale(1, -1);
            break;
        case 5:
            ctx.scale(-1, 1);
            ctx.rotate((90 * Math.PI) / 180);
            break;
        case 6:
            ctx.rotate((90 * Math.PI) / 180);
            ctx.translate(0, -outH);
            break;
        case 7:
            ctx.scale(-1, 1);
            ctx.rotate((-90 * Math.PI) / 180);
            ctx.translate(-outW, 0);
            break;
        case 8:
            ctx.rotate((-90 * Math.PI) / 180);
            ctx.translate(-outW, 0);
            break;
    }

    return { canvas, ctx, width: outW, height: outH };
}
