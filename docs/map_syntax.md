# Sintaxe para Desenho de Mapas - Paçoca 2.5D

Este documento descreve como desenhar e estruturar mapas em formatos de **Texto (Grid ASCII)** e **JSON** para o jogo Paçoca, e como convertê-los automaticamente em níveis jogáveis (.tscn) dentro do Godot.

---

## Opção 1: Formato de Texto (Visual Grid ASCII)

O formato visual é ideal para desenhar fases rapidamente usando qualquer editor de texto. O topo do arquivo define configurações básicas do nível, enquanto a seção `[grid]` define a geometria da fase de maneira visual (vista lateral).

### Exemplo de Arquivo (`scripts/levels/level_03_map.txt`)

```text
level: 03
name: Templo do Caos

[grid]
                                                                                            
                                                                                            
                                                                        o o o               
                                                                       #######              
                                                                      /       \             
  P     o o o                  E                     S S S           #         #            
####   #######   D   V   E   #####   /##\   C   D   #######   /##\  #           #  D   #####
```

### Regras do Grid
- **Dimensões das Células**: Cada coluna no editor de texto representa **2 metros** no eixo horizontal (X). Por padrão, cada linha representa **4 metros** no eixo vertical (Y) (este valor pode ser configurado com o parâmetro `ystep` no cabeçalho).
- **Direção**:
  - A primeira coluna à esquerda é o início do nível (X menor).
  - A última linha no final do bloco de texto representa o chão mais baixo (Y = 0). As linhas acima aumentam a altura (Y maior).
- **Parâmetro `ystep`**: Define o espaçamento em metros entre cada linha vertical do grid. Por padrão é `4.0` para novos mapas, permitindo passagem do jogador caso haja linhas em branco. Caso queira o comportamento antigo de 1 metro por linha, adicione `ystep: 1.0` no cabeçalho do arquivo (como feito no `level_01.txt`).
- **Física contínua**: O conversor detecta sequências horizontais de plataformas (`#`) e as mescla em um único colisor de física no Godot, o que evita que o jogador fique preso nas emendas dos blocos!

### Legenda dos Caracteres

| Caractere | Elemento | Descrição no Godot |
| :--- | :--- | :--- |
| ` ` ou `.` | **Ar / Vazio** | Espaço vazio |
| `#` | **Plataforma de Grama** | Bloco sólido padrão (CSGBox3D) com base de pedra (SubRock) |
| `/` | **Rampa Subindo** | Rampa sólida inclinada para a direita (CSGPolygon3D) |
| `\` | **Rampa Descendo** | Rampa sólida inclinada para a esquerda (CSGPolygon3D) |
| `o` | **Anel (Ring)** | Item colecionável (`ring.tscn`) |
| `V` | **Mola Vertical** | Impulsiona o jogador para cima com força ajustável (`spring.tscn`) |
| `F` | **Mola Diagonal** | Impulsiona o jogador para frente e para cima (`spring.tscn`) |
| `D` ou `>` | **Acelerador (Dash Pad)** | Acelera o jogador na direção frontal (`dash_pad.tscn`) |
| `E` | **Inimigo Comum** | Robô patrulheiro básico (`enemy.tscn`) |
| `C` | **Inimigo Cacto** | Cacto patrulheiro (`cactus_enemy.tscn`) |
| `S` | **Espinhos** | Fileira de espinhos que causam dano (`spikes.tscn`) |
| `P` | **Spawn do Player** | Define a posição onde o jogador inicia na fase (SpawnPoint Marker3D) |

---

## Opção 2: Formato Estruturado (JSON)

O formato JSON é ideal caso prefira definir posições decimais exatas, definir parâmetros personalizados (velocidade dos inimigos, força das molas, etc.) ou usar geradores externos de fases.

### Exemplo de Arquivo JSON (`scripts/levels/level_03_map.json`)

```json
{
  "level": "03",
  "name": "Templo do Caos",
  "spawn": [4.0, 1.5],
  "platforms": [
    { "x": 3.0, "y": 0.0, "width": 8.0 },
    { "x": 20.0, "y": 0.0, "width": 14.0 }
  ],
  "ramps_up": [
    { "x": 73.0, "y": -0.5, "width": 2.0, "height": 1.0 }
  ],
  "ramps_down": [
    { "x": 79.0, "y": -0.5, "width": 2.0, "height": 1.0 }
  ],
  "rings": [
    [16.0, 1.2],
    [20.0, 1.2],
    [24.0, 1.2]
  ],
  "springs_vert": [
    { "x": 42.0, "y": -0.5, "force": 22.0 }
  ],
  "springs_diag": [
    { "x": 102.0, "y": 14.5, "force": 25.0, "dx": 1.2, "dy": 1.5, "lock": 0.6 }
  ],
  "dash_pads": [
    [34.0, -0.5],
    [96.0, -0.5]
  ],
  "enemies": [
    { "x": 50.0, "y": 0.0, "speed": 3.0 }
  ],
  "cactus_enemies": [
    { "x": 88.0, "y": 0.0, "speed": 1.25 }
  ],
  "spikes": [
    [106.0, 0.5],
    [110.0, 0.5]
  ]
}
```

---

## Como Usar o Conversor Automático

Temos um script conversor em Python (`scripts/convert_map.py`) que processa o arquivo de texto ou JSON, cria a base da cena do Godot (se ainda não existir), cria o módulo de geração de nível, e compila a cena final.

### Executando a Conversão

Abra o terminal na pasta raiz do projeto e execute:

```powershell
# Convertendo a partir de um arquivo de Grid de Texto (.txt)
python scripts/convert_map.py --input scripts/levels/level_03_map.txt --level 03

# Convertendo a partir de um arquivo JSON (.json)
python scripts/convert_map.py --input scripts/levels/level_03_map.json --level 03
```

O comando executará as seguintes etapas:
1. Identificará o arquivo de entrada.
2. Criará o arquivo de cena base em `src/scenes/levels/level_03.tscn` (com água, montanhas de fundo e SpawnPoint).
3. Gerará o script Python do nível em `scripts/levels/level_03.py`.
4. Compilará a geometria sólida final e distribuirá os itens e inimigos na cena `.tscn` do Godot.

Agora, basta abrir ou recarregar o projeto no editor Godot para visualizar e testar a nova fase jogável!
