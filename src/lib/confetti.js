// --- KONFETTI SYSTEM ---
export const createConfetti = () => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
    document.body.appendChild(container);

    const colors = ['#171717', '#525252', '#A3A3A3', '#16A34A', '#FAFAF9'];
    const shapes = ['circle', 'square'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        const size = Math.random() * 10 + 6;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const startX = Math.random() * window.innerWidth;
        const drift = (Math.random() - 0.5) * 200;

        confetti.style.cssText = `
            position:absolute;
            width:${size}px;
            height:${size}px;
            background:${color};
            border-radius:${shape === 'circle' ? '50%' : '2px'};
            left:${startX}px;
            top:-20px;
            opacity:1;
            transform:rotate(${Math.random() * 360}deg);
        `;

        container.appendChild(confetti);

        const duration = Math.random() * 1500 + 2000;
        const delay = Math.random() * 300;

        confetti.animate([
            { transform: `translateY(0) translateX(0) rotate(0deg)`, opacity: 1 },
            { transform: `translateY(${window.innerHeight + 100}px) translateX(${drift}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration,
            delay,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        });
    }

    setTimeout(() => container.remove(), 3500);
};
