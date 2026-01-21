export class MobileControls {
    constructor(player, world) {
        this.player = player;
        this.world = world;
        this.isMobile = this.detectMobile();

        if (this.isMobile) {
            console.log("Mobile device detected. Activating touch controls.");
            this.player.isMobile = true;
            this.createOverlay();
            this.setupTouchEvents();
        }
    }

    detectMobile() {
        const ua = navigator.userAgent;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    }

    createOverlay() {
        const ui = document.getElementById('ui');

        // Container
        const mobileUI = document.createElement('div');
        mobileUI.id = 'mobile-controls';

        // Joystick Zone (Left)
        this.joystickZone = document.createElement('div');
        this.joystickZone.id = 'joystick-zone';

        const joystickKnob = document.createElement('div');
        joystickKnob.id = 'joystick-knob';
        this.joystickZone.appendChild(joystickKnob);

        // Look Zone (Right - full half screen)
        this.lookZone = document.createElement('div');
        this.lookZone.id = 'look-zone';

        // Buttons Container
        const buttons = document.createElement('div');
        buttons.id = 'action-buttons';

        // Jump
        const jumpBtn = document.createElement('div');
        jumpBtn.className = 'mobile-btn';
        jumpBtn.id = 'btn-jump';
        jumpBtn.innerText = 'WAIT'; // Space icon or text

        // Place
        const placeBtn = document.createElement('div');
        placeBtn.className = 'mobile-btn';
        placeBtn.id = 'btn-place';
        placeBtn.innerText = '+';

        // Break
        const breakBtn = document.createElement('div');
        breakBtn.className = 'mobile-btn';
        breakBtn.id = 'btn-break';
        breakBtn.innerText = '-';

        buttons.appendChild(jumpBtn);
        buttons.appendChild(placeBtn);
        buttons.appendChild(breakBtn);

        mobileUI.appendChild(this.joystickZone);
        mobileUI.appendChild(this.lookZone);
        mobileUI.appendChild(buttons);

        ui.appendChild(mobileUI);

        this.joystickKnob = joystickKnob;
    }

    setupTouchEvents() {
        // --- JOYSTICK (Movement) ---
        let joyStartX = 0;
        let joyStartY = 0;
        let joyId = null;

        const handleJoyMove = (itemX, itemY) => {
            const maxDist = 40;
            const dx = itemX - joyStartX;
            const dy = itemY - joyStartY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let moveX = dx;
            let moveY = dy;

            if (dist > maxDist) {
                moveX = (dx / dist) * maxDist;
                moveY = (dy / dist) * maxDist;
            }

            // Visual
            this.joystickKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;

            // Input Mapping
            // Thresholds
            this.player.input.right = moveX > 10;
            this.player.input.left = moveX < -10;
            this.player.input.backward = moveY > 10;
            this.player.input.forward = moveY < -10;

            // Sprint check (pushed far)
            this.player.input.sprint = dist > 35;
        };

        const resetJoy = () => {
            joyId = null;
            this.joystickKnob.style.transform = `translate(0px, 0px)`;
            this.player.input.forward = false;
            this.player.input.backward = false;
            this.player.input.left = false;
            this.player.input.right = false;
            this.player.input.sprint = false;
        };


        this.joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joyId = touch.identifier;
            joyStartX = touch.clientX;
            joyStartY = touch.clientY;

            // Move knob to finger initially? No, center stays, knob moves relative
            // But usually virtual joystick centers on touch. Let's keep it static for simple implementation first.
            // Actually, static joystick is easier to muscle memory.

            // Re-center logic if we wanted dynamic:
            // joyStartX = touch.clientX; joyStartY = touch.clientY;
            // this.joystickKnob.style.left = ...
        }, { passive: false });

        this.joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joyId) {
                    handleJoyMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                    break;
                }
            }
        }, { passive: false });

        this.joystickZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joyId) {
                    resetJoy();
                    break;
                }
            }
        });

        // --- LOOK (Camera) ---
        let lookStartX = 0;
        let lookStartY = 0;
        let lookId = null;

        this.lookZone.addEventListener('touchstart', (e) => {
            // e.preventDefault(); // Don't block all, might want UI interactions? 
            // Look zone is background, so yes prevent default to stop scrolling
            const touch = e.changedTouches[0];
            lookId = touch.identifier;
            lookStartX = touch.clientX;
            lookStartY = touch.clientY;
        }, { passive: false });

        this.lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scroll
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookId) {
                    const t = e.changedTouches[i];
                    const dx = t.clientX - lookStartX;
                    const dy = t.clientY - lookStartY;

                    this.player.rotateCamera(dx * 2, dy * 2); // Multiplier for sensitivity

                    lookStartX = t.clientX;
                    lookStartY = t.clientY;
                    break;
                }
            }
        }, { passive: false });

        this.lookZone.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookId) {
                    lookId = null;
                    break;
                }
            }
        });


        // --- BUTTONS ---
        const btnJump = document.getElementById('btn-jump');
        const btnPlace = document.getElementById('btn-place');
        const btnBreak = document.getElementById('btn-break');

        // Jump
        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.player.input.jump = true;
            // Immediate physics application handled in loop, but if it's impulse:
            if (this.player.canJump && !this.player.isSwimming) {
                this.player.velocity.y += 12;
                this.player.canJump = false;
            }
            btnJump.classList.add('active-btn');
        });
        btnJump.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.player.input.jump = false;
            btnJump.classList.remove('active-btn');
        });

        // Place
        btnPlace.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Simulate Right Click
            this.simulateClick(2);
            btnPlace.classList.add('active-btn');
        });
        btnPlace.addEventListener('touchend', () => btnPlace.classList.remove('active-btn'));

        // Break
        btnBreak.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Simulate Left Click
            this.simulateClick(0);
            btnBreak.classList.add('active-btn');
        });
        btnBreak.addEventListener('touchend', () => btnBreak.classList.remove('active-btn'));
    }

    simulateClick(buttonInfo) {
        // Dispatch event or call logic directly?
        // Dispatching event on window might be caught by main.js logic
        // main.js: window.addEventListener('mousedown', ...) checks for controls.isLocked
        // WE need to override that check or fake it.
        // We set player.isMobile = true, updated Player check.
        // main.js also checks `if (!player.controls.isLocked) return;` at line 140.
        // We need to update main.js to allow if isMobile.

        const evt = new MouseEvent('mousedown', {
            button: buttonInfo,
            bubbles: true,
            cancelable: true,
            view: window
        });
        window.dispatchEvent(evt);
    }
}
