import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =====================================================
// 1. ELEMENTOS HTML
// =====================================================

const canvas = document.getElementById('recorridoCanvas');
const pantallaInicio = document.getElementById('pantallaInicio');
const btnIniciar = document.getElementById('btnIniciar');
const mensajeError = document.getElementById('mensajeError');

// Elementos de la barra de progreso del modelo 3D
const barraCargaModelo = document.getElementById('barraCargaModelo');
const porcentajeCargaModelo = document.getElementById('porcentajeCargaModelo');
const textoCargaModelo = document.getElementById('textoCargaModelo');
const estadoCargaModelo = document.getElementById('estadoCargaModelo');
const contenedorBarraCarga = document.getElementById('contenedorBarraCarga');

const modalInfo = document.getElementById('modalInfo');
const contenidoInfo = document.getElementById('contenidoInfo');
const btnCerrarInfo = document.getElementById('btnCerrarInfo');

// =====================================================
// 1.1. ESTILO DE LAS IMÁGENES INFORMATIVAS
// =====================================================

const estiloImagenesInfo = document.createElement('style');

estiloImagenesInfo.textContent = `
    #contenidoInfo .imagen-informacion {
        display: block;
        width: 100%;
        max-width: 480px;
        height: 270px;
        object-fit: cover;
        object-position: center center;
        margin: 20px auto;
        border-radius: 10px;
        border: 2px solid rgba(212, 175, 55, 0.7);
        box-shadow: 0 5px 18px rgba(0, 0, 0, 0.35);
        box-sizing: border-box;
    }

    @media (max-width: 600px) {
        #contenidoInfo .imagen-informacion {
            max-width: 100%;
            height: 210px;
            margin: 16px auto;
        }
    }
`;

document.head.appendChild(estiloImagenesInfo);

const musica = document.getElementById('musicaRecorrido');
const btnPlay = document.getElementById('btnPlay');
const btnPausa = document.getElementById('btnPausa');
const btnSilenciar = document.getElementById('btnSilenciar');
const controlVolumen = document.getElementById('controlVolumen');
const audioEstado = document.getElementById('audioEstado');

// CONTROLES ADICIONALES
const controlLuz = document.getElementById('controlLuz');
const valorLuz = document.getElementById('valorLuz');
const btnPantallaCompleta = document.getElementById('btnPantallaCompleta');

// =====================================================
// 2. ESCENA
// =====================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x18211e);
scene.fog = new THREE.Fog(0x18211e, 35, 100);

// =====================================================
// 3. CÁMARA Y RENDERIZADOR
// =====================================================

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    300
);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Exposición original.
const EXPOSICION_BASE = 1.15;

// =====================================================
// 4. ILUMINACIÓN
// =====================================================

const luzAmbiente = new THREE.HemisphereLight(
    0xfff0d5,
    0x39352d,
    2
);

scene.add(luzAmbiente);

const luzPrincipal = new THREE.DirectionalLight(0xffe2ad, 2.2);
luzPrincipal.position.set(10, 20, 10);
luzPrincipal.castShadow = true;
scene.add(luzPrincipal);

const luzRelleno = new THREE.DirectionalLight(0xffffff, 0.8);
luzRelleno.position.set(-10, 8, -10);
scene.add(luzRelleno);

// Intensidades originales.
const INTENSIDAD_AMBIENTE = 2;
const INTENSIDAD_PRINCIPAL = 2.2;
const INTENSIDAD_RELLENO = 0.8;

// =====================================================
// 4.1. CONTROL REAL DE ILUMINACIÓN
// =====================================================

function ajustarIluminacion(valor) {

    const intensidad = Number(valor) / 100;

    luzAmbiente.intensity =
        INTENSIDAD_AMBIENTE * intensidad;

    luzPrincipal.intensity =
        INTENSIDAD_PRINCIPAL * intensidad;

    luzRelleno.intensity =
        INTENSIDAD_RELLENO * intensidad;

    renderer.toneMappingExposure =
        EXPOSICION_BASE * intensidad;

    if (valorLuz) {
        valorLuz.textContent = `${valor}%`;
    }

}

if (controlLuz) {

    controlLuz.addEventListener('input', () => {

        ajustarIluminacion(controlLuz.value);

    });

    ajustarIluminacion(controlLuz.value);

}

// =====================================================
// 5. CONTROLES DEL RECORRIDO
// =====================================================

const controls = new PointerLockControls(camera, document.body);

controls.pointerSpeed = 0.8;

const teclas = {
    w: false,
    a: false,
    s: false,
    d: false
};

const ALTURA_OJOS = 0.70;
const VELOCIDAD = 0.80;
const DISTANCIA_COLISION = 0.15;
const RADIO_VISITANTE = 0.05;

const reloj = new THREE.Clock();

let modelo = null;
let modeloListo = false;
let recorridoIniciado = false;
let cajaModelo = null;
let mostrandoInformacion = false;
let puntoEnfocado = null;

// Indica que el cursor se liberó mediante TAB.
let liberarCursorParaControles = false;

const raycaster = new THREE.Raycaster();
const direccion = new THREE.Vector3();
const derecha = new THREE.Vector3();
const arriba = new THREE.Vector3(0, 1, 0);
const origenRay = new THREE.Vector3();

const puntosInteractivos = [];

// =====================================================
// 6. CONFIGURACIÓN DE FACHADA Y PUERTA
// =====================================================

const FACHADA_EJE = 'z';
const FACHADA_LADO = 'min';
const DISTANCIA_FACHADA = 2.5;

const ANCHO_PUERTA = 1.8;
const PROFUNDIDAD_PASO = 3.5;
const MARGEN_ENTRADA = 0.5;

const DISTANCIA_ACTIVACION = 3.2;

// =====================================================
// 7. POSICIÓN INICIAL DE LA CÁMARA
// =====================================================

function colocarCamaraEnFachada(caja) {

    const centro = caja.getCenter(new THREE.Vector3());

    let posicionX = centro.x;
    let posicionZ = centro.z;
    let rotacionY = 0;

    if (FACHADA_EJE === 'z') {

        if (FACHADA_LADO === 'min') {

            posicionZ = caja.min.z - DISTANCIA_FACHADA;
            rotacionY = Math.PI;

        } else {

            posicionZ = caja.max.z + DISTANCIA_FACHADA;
            rotacionY = 0;

        }

    } else {

        if (FACHADA_LADO === 'min') {

            posicionX = caja.min.x - DISTANCIA_FACHADA;
            rotacionY = -Math.PI / 2;

        } else {

            posicionX = caja.max.x + DISTANCIA_FACHADA;
            rotacionY = Math.PI / 2;

        }

    }

    camera.position.set(
        posicionX,
        ALTURA_OJOS,
        posicionZ
    );

    camera.rotation.set(0, rotacionY, 0);

}

// =====================================================
// 8. INFORMACIÓN HISTÓRICA
// =====================================================

const informacion = {

    fachada: {
        titulo: 'Historia y arquitectura',

        contenido: `
            <h2>Historia y arquitectura de la Casa Nacional de Moneda</h2>
<img
        class="imagen-informacion"
        src="img/fachada.jpg"
        alt="Fachada de la Casa Nacional de Moneda de Potosí"
    >
            <p>
                La construcción del edificio actual de la Casa Nacional
                de Moneda se realizó entre los años 1759 y 1773.
                Su edificación respondió a la importancia que había
                adquirido Potosí por la explotación de la plata y a la
                necesidad de contar con instalaciones destinadas
                a la fabricación de moneda.
            </p>

            <p>
                Su arquitectura presenta características del periodo
                colonial, con muros robustos, patios interiores,
                galerías y elementos constructivos de piedra y ladrillo.
                También se reconocen detalles relacionados con el
                barroco andino, que forman parte de la identidad
                arquitectónica del monumento.
            </p>

            <p>
                La Casa de Moneda acuñó piezas para la Corona española
                y posteriormente para distintos periodos de la
                historia republicana. Actualmente conserva colecciones
                y espacios que permiten conocer la historia económica,
                artística y cultural de Potosí.
            </p>

            <div class="modal-fuente">
                <strong>Fuente institucional:</strong><br>

                <a href="https://www.casanacionaldemoneda.bo/"
                   target="_blank"
                   rel="noopener noreferrer">
                   Casa Nacional de Moneda – Sitio institucional
                </a>
            </div>
        `
    },

    visitas: {
        titulo: 'Información para las visitas',

        contenido: `
            <h2>Información para el visitante</h2>

             <img
        class="imagen-informacion"
        src="img/visita.png"
        alt="Primer patio de la Casa Nacional de Moneda"
    >
            <p>
                La Casa Nacional de Moneda ofrece recorridos guiados
                para que los visitantes conozcan sus ambientes,
                colecciones y elementos históricos. Los turnos
                publicados contemplan diferentes horarios e idiomas.
            </p>

            <h3>Turnos de visita · Lunes a viernes</h3>

            <p>
                <strong>Español:</strong>
                09:00, 09:30, 10:00, 10:30, 11:30,
                12:00, 12:30, 13:30, 14:00 y 15:00.
            </p>

            <p>
                <strong>Inglés, francés e italiano:</strong>
                09:00, 11:00 y 14:30.
            </p>

            <h3>Sábados y domingos</h3>

            <p>
                <strong>Español:</strong>
                09:15, 10:00, 10:30 y 11:30.
            </p>

            <p>
                <strong>Inglés, francés e italiano:</strong>
                09:15 y 11:00.
            </p>

            <p>
                La boletería cierra a las 15:15 de lunes a viernes
                y a las 11:45 los sábados y domingos.
                El recorrido tiene una duración aproximada de
                una hora y treinta minutos, con un máximo de
                25 visitantes por turno.
            </p>

            <h3>Tarifas de ingreso</h3>

            <ul>
                <li>Nacionales: <strong>Bs 20</strong>.</li>
                <li>Extranjeros: <strong>Bs 70</strong>.</li>
                <li>
                    Menores de 10 años: ingreso gratuito,
                    presentando documento boliviano.
                </li>
                <li>
                    Personas mayores de 60 años: ingreso gratuito,
                    presentando documento boliviano.
                </li>
                <li>Cámara fotográfica: <strong>Bs 20</strong>.</li>
                <li>Cámara filmadora: <strong>Bs 40</strong>.</li>
            </ul>

            <p>
                Se recomienda confirmar los horarios y tarifas
                directamente con la institución antes de realizar
                la visita, ya que pueden estar sujetos a cambios.
            </p>

            <div class="modal-fuente">
                <strong>Fuente institucional:</strong><br>

                <a href="https://www.casanacionaldemoneda.bo/images/ex3.jpg"
                   target="_blank"
                   rel="noopener noreferrer">
                   Información oficial para visitantes
                </a>
                <br>

                <a href="https://www.casanacionaldemoneda.bo/"
                   target="_blank"
                   rel="noopener noreferrer">
                   Casa Nacional de Moneda
                </a>
            </div>
        `
    },

    fuente: {
        titulo: 'El primer patio',

        contenido: `
            <h2>El primer patio de la Casa Nacional de Moneda</h2>
 <img
        class="imagen-informacion"
        src="img/patio.jpeg"
        alt="Primer patio de la Casa Nacional de Moneda"
    >

            <p>
                El primer patio constituye uno de los espacios
                arquitectónicos más representativos de la Casa
                Nacional de Moneda. Su diseño permite apreciar
                la organización de los ambientes interiores y
                la distribución de las galerías que rodean
                el espacio central.
            </p>

            <p>
                Al recorrer este patio se pueden observar sus
                columnas de piedra, los balcones de madera
                y los elementos constructivos que conservan
                características de la arquitectura colonial.
                Estos componentes forman parte del conjunto
                histórico y permiten apreciar el trabajo
                arquitectónico y artesanal de la época.
            </p>

            <p>
                El espacio central también destaca por la
                presencia de un pilón o fuente de piedra,
                que complementa la composición del patio.
                Junto con los corredores y las galerías,
                este elemento contribuye a la identidad
                visual de uno de los ambientes más conocidos
                del edificio.
            </p>

            <p>
                El patio no solamente funciona como un espacio
                de circulación, sino que permite observar
                cómo se organizaban los ambientes alrededor
                de un espacio abierto dentro de la construcción.
            </p>

            <div class="modal-fuente">
                <strong>Fuentes de consulta:</strong><br>

                <a href="https://www.casanacionaldemoneda.bo/"
                   target="_blank"
                   rel="noopener noreferrer">
                   Casa Nacional de Moneda – Sitio institucional
                </a>
                <br>

                <a href="https://elpotosi.net/"
                   target="_blank"
                   rel="noopener noreferrer">
                   El Potosí – Información cultural de Potosí
                </a>
            </div>
        `
    },

    mascaron: {
        titulo: 'El Mascarón',

        contenido: `
            <h2>El emblemático Mascarón</h2>
 <img
        class="imagen-informacion"
        src="img/mascaron.jpeg"
        alt="Primer patio de la Casa Nacional de Moneda"
    >
            <p>
                El Mascarón es una de las piezas más conocidas
                de la Casa Nacional de Moneda. Se encuentra
                en el primer patio y constituye uno de los
                elementos más representativos del edificio.
            </p>

            <p>
                Esta obra fue tallada en 1856 por el francés
                Eugenio Martín Mulón. Según la información
                institucional, Mulón trabajó en la elaboración
                de troqueles, punzones y matrices utilizados
                para fabricar monedas y medallas conmemorativas.
            </p>

            <p>
                Con el paso del tiempo, el Mascarón se convirtió
                en un elemento representativo del patrimonio
                cultural potosino.
            </p>

            <p>
                Sobre su identidad y significado existen
                diferentes interpretaciones. Por ello, es
                importante reconocer su valor histórico y
                artístico sin afirmar que existe una única
                explicación definitiva sobre a quién representa.
            </p>

            <div class="modal-fuente">
                <strong>Fuentes de consulta:</strong><br>

                <a href="https://www.casanacionaldemoneda.bo/"
                   target="_blank"
                   rel="noopener noreferrer">
                   Casa Nacional de Moneda – Sitio institucional
                </a>
                <br>

                <a href="https://historico.abi.bo/index.php/noticias/culturas/39159-concluye-intervencion-del-mascaron-de-la-casa-nacional-de-moneda-y-hoy-luce-todo-su-esplendor"
                   target="_blank"
                   rel="noopener noreferrer">
                   Agencia Boliviana de Información – El Mascarón
                </a>
                <br>

                <a href="https://elpotosi.net/"
                   target="_blank"
                   rel="noopener noreferrer">
                   El Potosí – Información cultural
                </a>
            </div>
        `
    }

};

// =====================================================
// 9. AVISO DE INTERACCIÓN
// =====================================================

const avisoPunto = document.createElement('div');

avisoPunto.id = 'avisoPunto';
avisoPunto.textContent = 'PRESIONA E PARA VER INFORMACIÓN';

Object.assign(avisoPunto.style, {

    position: 'fixed',
    zIndex: '30',
    left: '50%',
    bottom: '16%',
    transform: 'translateX(-50%)',

    padding: '10px 17px',

    color: '#fff4c2',
    background: 'rgba(7,23,19,.92)',

    border: '1px solid #D4AF37',
    boxShadow: '0 0 18px rgba(212,175,55,.45)',

    font: '600 11px Montserrat, sans-serif',
    letterSpacing: '1px',

    pointerEvents: 'none',
    display: 'none'

});

document.body.appendChild(avisoPunto);

// =====================================================
// 10. CREACIÓN DE LOS MARCADORES
// =====================================================

function crearMarcador() {

    const grupo = new THREE.Group();

    const aro = new THREE.Mesh(

        new THREE.RingGeometry(0.105, 0.145, 40),

        new THREE.MeshBasicMaterial({
            color: 0xD4AF37,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        })

    );

    const centro = new THREE.Mesh(

        new THREE.CircleGeometry(0.105, 40),

        new THREE.MeshBasicMaterial({
            color: 0xD4AF37,
            side: THREE.DoubleSide
        })

    );

    const letraCanvas = document.createElement('canvas');

    letraCanvas.width = 128;
    letraCanvas.height = 128;

    const ctx = letraCanvas.getContext('2d');

    ctx.fillStyle = '#071713';
    ctx.font = 'bold 94px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText('i', 64, 66);

    const textura = new THREE.CanvasTexture(letraCanvas);
    textura.colorSpace = THREE.SRGBColorSpace;

    const letra = new THREE.Sprite(

        new THREE.SpriteMaterial({
            map: textura,
            transparent: true,
            depthTest: false
        })

    );

    letra.scale.set(0.12, 0.12, 1);
    letra.position.z = 0.012;

    const halo = new THREE.Mesh(

        new THREE.RingGeometry(0.17, 0.23, 48),

        new THREE.MeshBasicMaterial({
            color: 0xffd84d,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0,
            depthWrite: false
        })

    );

    grupo.add(aro);
    grupo.add(centro);
    grupo.add(halo);
    grupo.add(letra);

    grupo.userData.aro = aro;
    grupo.userData.halo = halo;

    return grupo;

}

// =====================================================
// 11. POSICIÓN DE LOS CUATRO PUNTOS
// =====================================================

function crearPuntosInteractivos(caja) {

    const centro = caja.getCenter(new THREE.Vector3());

    const ancho = caja.max.x - caja.min.x;
    const profundidad = caja.max.z - caja.min.z;
    const altura = caja.max.y - caja.min.y;

    const POSICION_MASCARON_Z = 0.66;

    const posiciones = {

        fachada: new THREE.Vector3(
            centro.x,
            caja.min.y + altura * 0.66,
            caja.min.z - 0.18
        ),

        visitas: new THREE.Vector3(
            centro.x,
            caja.min.y + altura * 0.38,
            caja.min.z + profundidad * 0.16
        ),

        fuente: new THREE.Vector3(
            centro.x - ancho * 0.04,
            caja.min.y + altura * 0.34,
            caja.min.z + profundidad * 0.53
        ),

        mascaron: new THREE.Vector3(
            centro.x + ancho * 0.035,
            caja.min.y + altura * 0.48,
            caja.min.z + profundidad * POSICION_MASCARON_Z
        )

    };

    Object.entries(posiciones).forEach(([tipo, posicion]) => {

        const punto = crearMarcador();

        punto.position.copy(posicion);

        punto.userData.tipo = tipo;
        punto.userData.nombre = informacion[tipo].titulo;

        scene.add(punto);

        puntosInteractivos.push(punto);

    });

    console.log('Puntos informativos creados:', posiciones);

}

// =====================================================
// 12. DETECTAR CUANDO SE MIRA UN PUNTO
// =====================================================

function actualizarPuntoEnfocado() {

    if (
        !controls.isLocked ||
        mostrandoInformacion ||
        !modeloListo
    ) {

        puntoEnfocado = null;
        avisoPunto.style.display = 'none';

        return;

    }

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    raycaster.far = DISTANCIA_ACTIVACION;

    const impactos = raycaster.intersectObjects(
        puntosInteractivos,
        true
    );

    let puntoEncontrado = null;

    if (impactos.length > 0) {

        let objeto = impactos[0].object;

        while (objeto && !objeto.userData.tipo) {

            objeto = objeto.parent;

        }

        if (objeto && objeto.userData.tipo) {

            puntoEncontrado = objeto;

        }

    }

    puntosInteractivos.forEach(punto => {

        const enfocado = punto === puntoEncontrado;

        const escalaObjetivo = enfocado ? 1.22 : 1;

        punto.scale.lerp(
            new THREE.Vector3(
                escalaObjetivo,
                escalaObjetivo,
                escalaObjetivo
            ),
            0.18
        );

        punto.userData.halo.material.opacity =
            enfocado ? 0.9 : 0;

        punto.userData.aro.material.color.set(
            enfocado ? 0xffe16b : 0xD4AF37
        );

        punto.userData.halo.scale.setScalar(

            enfocado
                ? 1.08 + Math.sin(performance.now() * 0.006) * 0.08
                : 1

        );

    });

    puntoEnfocado = puntoEncontrado;

    avisoPunto.style.display =
        puntoEncontrado ? 'block' : 'none';

}

// =====================================================
// 13. INTERACCIÓN CON LA TECLA E
// =====================================================

function interactuarPunto() {

    if (!controls.isLocked || !puntoEnfocado) return;

    abrirInformacion(puntoEnfocado.userData.tipo);

}

// =====================================================
// 14. VENTANA DE INFORMACIÓN
// =====================================================

function abrirInformacion(tipo) {

    const dato = informacion[tipo];

    if (!dato) return;

    contenidoInfo.innerHTML = dato.contenido;

    modalInfo.classList.remove('oculto');

    mostrandoInformacion = true;

    avisoPunto.style.display = 'none';

    if (controls.isLocked) {

        controls.unlock();

    }

}

function cerrarInformacion() {

    modalInfo.classList.add('oculto');

    mostrandoInformacion = false;

    if (recorridoIniciado) {

        controls.lock();

    }

}

btnCerrarInfo.addEventListener('click', cerrarInformacion);

modalInfo.addEventListener('click', event => {

    if (event.target === modalInfo) {

        cerrarInformacion();

    }

});

// =====================================================
// 15. CARGAR EL MODELO 3D Y MOSTRAR EL PROGRESO
// =====================================================

const loader = new GLTFLoader();

// Actualiza visualmente el porcentaje real de descarga.
function actualizarProgresoCarga(porcentaje) {

    const valor = Math.max(0, Math.min(100, Math.round(porcentaje)));

    barraCargaModelo.style.width = `${valor}%`;
    barraCargaModelo.classList.remove('indeterminado');

    porcentajeCargaModelo.textContent = `${valor}%`;
    textoCargaModelo.textContent = 'Cargando modelo 3D...';

    contenedorBarraCarga.setAttribute('aria-valuenow', valor);

    estadoCargaModelo.textContent =
        'Descargando los datos del modelo. Por favor, espera.';

}

// Se utiliza cuando el servidor no informa el tamaño total del archivo.
// En ese caso se muestra una animación, sin inventar un porcentaje.
function mostrarCargaIndeterminada() {

    barraCargaModelo.classList.add('indeterminado');

    porcentajeCargaModelo.textContent = '...';

    textoCargaModelo.textContent = 'Cargando modelo 3D...';

    contenedorBarraCarga.removeAttribute('aria-valuenow');

    estadoCargaModelo.textContent =
        'Preparando el modelo. Esto puede tardar unos momentos.';

}

// Estado inicial de la ventana.
btnIniciar.disabled = true;
btnIniciar.textContent = 'ESPERANDO MODELO...';

mostrarCargaIndeterminada();

loader.load(

    'explorar.glb',

    gltf => {

        modelo = gltf.scene;

        modelo.rotation.y = Math.PI;

        modelo.traverse(objeto => {

            if (objeto.isMesh) {

                objeto.castShadow = true;
                objeto.receiveShadow = true;

            }

        });

        const cajaOriginal = new THREE.Box3().setFromObject(modelo);

        const centro = cajaOriginal.getCenter(
            new THREE.Vector3()
        );

        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;
        modelo.position.y -= cajaOriginal.min.y;

        scene.add(modelo);

        modelo.updateMatrixWorld(true);

        const cajaFinal = new THREE.Box3().setFromObject(modelo);

        cajaModelo = cajaFinal.clone();

        colocarCamaraEnFachada(cajaFinal);

        crearPuntosInteractivos(cajaFinal);

        modeloListo = true;

        // El modelo ya terminó de descargarse y prepararse.
        barraCargaModelo.classList.remove('indeterminado');

        barraCargaModelo.style.width = '100%';

        porcentajeCargaModelo.textContent = '100%';

        textoCargaModelo.textContent = '¡Modelo listo!';

        contenedorBarraCarga.setAttribute('aria-valuenow', '100');

        estadoCargaModelo.textContent =
            'El recorrido virtual está preparado para comenzar.';

        btnIniciar.disabled = false;

        btnIniciar.textContent = 'INICIAR RECORRIDO';

        console.log('Modelo cargado correctamente.');

    },

    progreso => {

        if (progreso.total > 0) {

            const porcentaje = Math.round(
                progreso.loaded / progreso.total * 100
            );

            actualizarProgresoCarga(porcentaje);

            console.log('Cargando modelo:', porcentaje + '%');

        } else {

            mostrarCargaIndeterminada();

            console.log('Cargando modelo 3D...');

        }

    },

    error => {

        console.error('Error al cargar explorar.glb:', error);

        barraCargaModelo.classList.remove('indeterminado');

        barraCargaModelo.style.width = '0%';

        porcentajeCargaModelo.textContent = 'Error';

        textoCargaModelo.textContent = 'No se pudo cargar el modelo 3D';

        estadoCargaModelo.textContent =
            'Comprueba que explorar.glb esté en la carpeta principal.';

        mensajeError.textContent =
            'No se pudo cargar explorar.glb. Comprueba que esté en la carpeta principal.';

        btnIniciar.disabled = true;

        btnIniciar.textContent = 'MODELO NO DISPONIBLE';

    }

);

// =====================================================
// 16. ZONA LIBRE DE COLISIONES DE LA PUERTA
// =====================================================


function estaEnZonaPuerta(posicion, dir) {

    if (!cajaModelo) return false;

    const centro = cajaModelo.getCenter(
        new THREE.Vector3()
    );

    let movimientoPorPuerta = false;
    let dentroDelAncho = false;
    let dentroDeLaProfundidad = false;

    if (
        FACHADA_EJE === 'z' &&
        FACHADA_LADO === 'min'
    ) {

        // Permite entrar y salir por la puerta
        movimientoPorPuerta = Math.abs(dir.z) > 0.35;

        dentroDelAncho =
            Math.abs(posicion.x - centro.x) < ANCHO_PUERTA / 2;

        dentroDeLaProfundidad =
            posicion.z >= cajaModelo.min.z - MARGEN_ENTRADA &&
            posicion.z <= cajaModelo.min.z + PROFUNDIDAD_PASO;

    } else if (
        FACHADA_EJE === 'z' &&
        FACHADA_LADO === 'max'
    ) {

        movimientoPorPuerta = Math.abs(dir.z) > 0.35;

        dentroDelAncho =
            Math.abs(posicion.x - centro.x) < ANCHO_PUERTA / 2;

        dentroDeLaProfundidad =
            posicion.z <= cajaModelo.max.z + MARGEN_ENTRADA &&
            posicion.z >= cajaModelo.max.z - PROFUNDIDAD_PASO;

    } else if (
        FACHADA_EJE === 'x' &&
        FACHADA_LADO === 'min'
    ) {

        movimientoPorPuerta = Math.abs(dir.x) > 0.35;

        dentroDelAncho =
            Math.abs(posicion.z - centro.z) < ANCHO_PUERTA / 2;

        dentroDeLaProfundidad =
            posicion.x >= cajaModelo.min.x - MARGEN_ENTRADA &&
            posicion.x <= cajaModelo.min.x + PROFUNDIDAD_PASO;

    } else {

        movimientoPorPuerta = Math.abs(dir.x) > 0.35;

        dentroDelAncho =
            Math.abs(posicion.z - centro.z) < ANCHO_PUERTA / 2;

        dentroDeLaProfundidad =
            posicion.x <= cajaModelo.max.x + MARGEN_ENTRADA &&
            posicion.x >= cajaModelo.max.x - PROFUNDIDAD_PASO;

    }

    return (
        movimientoPorPuerta &&
        dentroDelAncho &&
        dentroDeLaProfundidad
    );

}


// =====================================================
// 17. INICIAR Y CONTINUAR EL RECORRIDO
// =====================================================

btnIniciar.addEventListener('click', () => {

    if (!modeloListo) {

        mensajeError.textContent =
            'Espera a que termine de cargar el modelo 3D.';

        return;

    }

    mensajeError.textContent = '';

    iniciarMusica();

    controls.lock();

});

// Cuando se activa el recorrido.
controls.addEventListener('lock', () => {

    recorridoIniciado = true;

    liberarCursorParaControles = false;

    pantallaInicio.classList.add('oculto');

});

// Cuando se libera el cursor.
controls.addEventListener('unlock', () => {

    limpiarTeclas();

    // Si se abrió una ventana informativa,
    // no mostrar la pantalla de inicio.
    if (mostrandoInformacion) return;

    // Si se presionó TAB, liberar el cursor
    // sin mostrar la pantalla de continuar.
    if (liberarCursorParaControles) {

        liberarCursorParaControles = false;

        return;

    }

    // Si se presionó ESC, mostrar la pantalla
    // para continuar el recorrido.
    if (recorridoIniciado) {

        pantallaInicio.classList.remove('oculto');

        btnIniciar.textContent = 'CONTINUAR RECORRIDO';

    }

});

// Al hacer clic en el escenario 3D,
// se vuelve a activar el movimiento.
canvas.addEventListener('click', () => {

    if (
        recorridoIniciado &&
        !controls.isLocked &&
        !mostrandoInformacion
    ) {

        controls.lock();

    }

});

// =====================================================
// 18. MOVIMIENTO CON EL TECLADO
// =====================================================

function limpiarTeclas() {

    Object.keys(teclas).forEach(tecla => {

        teclas[tecla] = false;

    });

}

document.addEventListener('keydown', event => {

    const tecla = event.key.toLowerCase();

    // TAB: liberar el cursor para utilizar
    // el reproductor y los controles de iluminación.
    if (tecla === 'tab' && controls.isLocked) {

        event.preventDefault();

        liberarCursorParaControles = true;

        controls.unlock();

        return;

    }

    // Movimiento del visitante.
    if (tecla in teclas) {

        teclas[tecla] = true;

        if (controls.isLocked) {

            event.preventDefault();

        }

    }

    // Abrir información de los puntos.
    if (tecla === 'e' && controls.isLocked) {

        event.preventDefault();

        interactuarPunto();

    }

    // Alternar música.
    if (tecla === 'm') {

        alternarMusica();

    }

    // Aumentar volumen.
    if (tecla === '+' || tecla === '=') {

        cambiarVolumen(0.05);

    }

    // Disminuir volumen.
    if (tecla === '-') {

        cambiarVolumen(-0.05);

    }

});

document.addEventListener('keyup', event => {

    const tecla = event.key.toLowerCase();

    if (tecla in teclas) {

        teclas[tecla] = false;

    }

});

document.addEventListener('blur', limpiarTeclas);

// =====================================================
// 19. COLISIONES
// =====================================================

function puedeAvanzar(dir) {

    if (!modelo) return false;

    if (estaEnZonaPuerta(camera.position, dir)) {

        return true;

    }

    const alturas = [0.25, 0.60, 0.95];

    const lateral = new THREE.Vector3()
        .crossVectors(dir, arriba)
        .normalize();

    const desplazamientos = [
        0,
        RADIO_VISITANTE,
        -RADIO_VISITANTE
    ];

    for (const altura of alturas) {

        for (const desplazamiento of desplazamientos) {

            origenRay.set(

                camera.position.x + lateral.x * desplazamiento,
                altura,
                camera.position.z + lateral.z * desplazamiento

            );

            raycaster.set(origenRay, dir);

            raycaster.near = 0.02;
            raycaster.far = DISTANCIA_COLISION;

            const impactos = raycaster.intersectObject(
                modelo,
                true
            );

            if (impactos.length > 0) {

                return false;

            }

        }

    }

    return true;

}

// =====================================================
// 20. ALTURA Y DESPLAZAMIENTO
// =====================================================

function mantenerAltura() {

    camera.position.y = ALTURA_OJOS;

}

function moverVisitante(delta) {

    if (!controls.isLocked || !modeloListo) return;

    const distancia = VELOCIDAD * delta;

    controls.getDirection(direccion);

    direccion.y = 0;
    direccion.normalize();

    derecha.crossVectors(
        direccion,
        arriba
    ).normalize();

    if (teclas.w && puedeAvanzar(direccion)) {

        controls.moveForward(distancia);

    }

    if (teclas.s) {

        const atras = direccion.clone().negate();

        if (puedeAvanzar(atras)) {

            controls.moveForward(-distancia);

        }

    }

    if (teclas.d && puedeAvanzar(derecha)) {

        controls.moveRight(distancia);

    }

    if (teclas.a) {

        const izquierda = derecha.clone().negate();

        if (puedeAvanzar(izquierda)) {

            controls.moveRight(-distancia);

        }

    }

    mantenerAltura();

}

// =====================================================
// 21. REPRODUCTOR MUSICAL
// =====================================================

musica.volume = Number(controlVolumen.value || 0.35);

async function iniciarMusica() {

    try {

        await musica.play();

        audioEstado.textContent = 'Reproduciendo: Potosí';

    } catch (error) {

        console.warn('No se pudo reproducir el audio:', error);

        audioEstado.textContent =
            'No se pudo iniciar. Comprueba audio/potosi.mp3.';

    }

}

function pausarMusica() {

    musica.pause();

    audioEstado.textContent = 'Música pausada';

}

function alternarMusica() {

    if (musica.paused) {

        iniciarMusica();

    } else {

        pausarMusica();

    }

}

function cambiarVolumen(cantidad) {

    musica.volume = THREE.MathUtils.clamp(
        musica.volume + cantidad,
        0,
        1
    );

    controlVolumen.value = musica.volume;

    audioEstado.textContent =
        'Volumen: ' + Math.round(musica.volume * 100) + '%';

}

btnPlay.addEventListener('click', iniciarMusica);

btnPausa.addEventListener('click', pausarMusica);

btnSilenciar.addEventListener('click', () => {

    musica.muted = !musica.muted;

    btnSilenciar.textContent =
        musica.muted ? '🔇' : '🔊';

    audioEstado.textContent =
        musica.muted ? 'Música silenciada' : 'Música activada';

});

controlVolumen.addEventListener('input', () => {

    musica.volume = Number(controlVolumen.value);

    audioEstado.textContent =
        'Volumen: ' + Math.round(musica.volume * 100) + '%';

});

// =====================================================
// 22. ZOOM CON LA RUEDA DEL MOUSE
// =====================================================

window.addEventListener('wheel', event => {

    if (!controls.isLocked) return;

    event.preventDefault();

    camera.fov += event.deltaY * 0.035;

    camera.fov = THREE.MathUtils.clamp(
        camera.fov,
        35,
        90
    );

    camera.updateProjectionMatrix();

}, { passive: false });

// =====================================================
// 23. PANTALLA COMPLETA
// =====================================================

if (btnPantallaCompleta) {

    btnPantallaCompleta.addEventListener('click', async () => {

        try {

            if (!document.fullscreenElement) {

                await document.documentElement.requestFullscreen();

            } else {

                await document.exitFullscreen();

            }

        } catch (error) {

            console.error(
                'No se pudo activar la pantalla completa:',
                error
            );

        }

    });

    document.addEventListener('fullscreenchange', () => {

        btnPantallaCompleta.textContent =
            document.fullscreenElement
                ? '⛶ SALIR DE PANTALLA COMPLETA'
                : '⛶ VER EN GRANDE';

        ajustarTamanoEscena();

    });

}

// =====================================================
// 24. ANIMACIÓN GENERAL
// =====================================================

function animar() {

    requestAnimationFrame(animar);

    const delta = Math.min(
        reloj.getDelta(),
        0.05
    );

    moverVisitante(delta);

    puntosInteractivos.forEach(punto => {

        punto.quaternion.copy(camera.quaternion);

    });

    actualizarPuntoEnfocado();

    renderer.render(scene, camera);

}

animar();

// =====================================================
// 25. AJUSTAR TAMAÑO DE VENTANA
// =====================================================

function ajustarTamanoEscena() {

    const ancho = window.innerWidth;
    const alto = window.innerHeight;

    camera.aspect = ancho / alto;

    camera.updateProjectionMatrix();

    renderer.setSize(ancho, alto);

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

}

window.addEventListener('resize', ajustarTamanoEscena);