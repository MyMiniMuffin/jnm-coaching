/**
 * Delt zoom-oppsett for ImageModal og GalleryView (react-zoom-pan-pinch v4).
 *
 * v3 → v4 (relevante brudd):
 * - wheel.smoothStep er fjernet; ved smooth=true er det wheel.step som
 *   multipliseres med |deltaY| (tidligere smoothStep * |deltaY|).
 * - alignmentAnimation er omdøpt til autoAlignment.
 * - onTransformed er omdøpt til onTransform (settes i ImageModal).
 */
export const IMAGE_ZOOM_PROPS = {
    initialScale: 1,
    minScale: 1,
    maxScale: 5,
    limitToBounds: true,
    centerZoomedOut: true,
    centerOnInit: true,
    smooth: true,
    wheel: {
        // Matcher tidligere smoothStep (0.004): step * |deltaY| ved smooth zoom.
        step: 0.004
    },
    pinch: {
        step: 7
    },
    doubleClick: {
        mode: 'toggle',
        step: 1.2,
        animationTime: 140,
        animationType: 'easeOut'
    },
    zoomAnimation: {
        size: 0.7,
        animationTime: 80,
        animationType: 'easeOut'
    },
    autoAlignment: {
        animationTime: 90,
        velocityAlignmentTime: 120,
        animationType: 'easeOut'
    },
    velocityAnimation: {
        disabled: true
    }
};
