// static/js/landing.js

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('neural-network-canvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    const ctx = canvas.getContext('2d');

    let particles = [];
    const numParticles = window.innerWidth > 768 ? 100 : 50; // Menos partículas em telas menores
    const connectDistance = 100;
    const particleColor = 'hsl(220, 85%, 55%)'; // Cor principal do seu tema

    // Ajusta o tamanho do canvas para o tamanho do container
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    // Classe para representar uma partícula
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5; // Velocidade horizontal
            this.vy = (Math.random() - 0.5) * 0.5; // Velocidade vertical
            this.radius = 2;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Faz as partículas voltarem para a tela quando saem
            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = particleColor;
            ctx.fill();
        }
    }

    // Cria as partículas iniciais
    function init() {
        particles = [];
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle());
        }
    }

    // Desenha as conexões entre partículas próximas
    function connectParticles() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < connectDistance) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    // A opacidade da linha diminui com a distância
                    ctx.strokeStyle = `hsla(220, 85%, 55%, ${1 - distance / connectDistance})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    // Loop de animação principal
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpa a tela

        particles.forEach(p => {
            p.update();
            p.draw();
        });

        connectParticles();

        requestAnimationFrame(animate); // Chama a próxima frame
    }

    // Inicializa e lida com o redimensionamento da janela
    resizeCanvas();
    init();
    animate();

    window.addEventListener('resize', () => {
        resizeCanvas();
        init(); // Reinicia as partículas para se adaptarem ao novo tamanho
    });
});