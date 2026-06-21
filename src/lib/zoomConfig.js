export const IMAGE_ZOOM_PROPS = {
    initialScale: 1,
    minScale: 1,
    maxScale: 5,
    limitToBounds: true,
    centerZoomedOut: true,
    centerOnInit: true,
    smooth: true,
    wheel: {
        step: 0.32,
        smoothStep: 0.004
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
    alignmentAnimation: {
        animationTime: 90,
        velocityAlignmentTime: 120,
        animationType: 'easeOut'
    },
    velocityAnimation: {
        disabled: true
    }
};
