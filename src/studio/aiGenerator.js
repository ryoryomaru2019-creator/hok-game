// AI Character Generator using Google Gemini Multimodal API
// Generates game-ready vector characters matching the Hirameita game art style

import { computeCurvatureHandles, pointsToSvgPath } from './pathUtils.js';
import { BASE_PRESETS, generateDefaultRigAnimations } from './model.js';

const STORAGE_KEY_API_KEY = 'hirame_gemini_api_key';
const STORAGE_KEY_MODEL = 'hirame_gemini_model';

const DEFAULT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (推奨・高速マルチモーダル)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (高精度・ディテール重視)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
];

export class AiCharacterGenerator {
  constructor(studioApp) {
    this.studioApp = studioApp;
    this.modal = null;
    this.currentReferenceImage = null; // { data: base64, mimeType: string, url: string }
    this.generatedCharacter = null;
    this.isGenerating = false;
  }

  isOpen() {
    return this.modal && !this.modal.classList.contains('hidden');
  }

  init() {
    this.injectModal();
    this.bindEvents();
  }

  getApiKey() {
    return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
  }

  setApiKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
  }

  getSelectedModel() {
    return localStorage.getItem(STORAGE_KEY_MODEL) || 'gemini-2.5-flash';
  }

  setSelectedModel(model) {
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  }

  injectModal() {
    const modalHtml = `
      <div id="modalAiGenerator" class="studio-modal-backdrop hidden">
        <div class="studio-modal ai-modal-dialog">
          <div class="studio-modal-header ai-modal-header">
            <div class="ai-header-title">
              <span class="ai-sparkle-icon">🪄</span>
              <div>
                <h3>Gemini AI キャラクター自動生成ツール</h3>
                <p class="ai-header-sub">参考画像やテキスト指示から、ゲーム同等のベクターパーツ＆階層構造を持つ新キャラクターを完全自動生成します</p>
              </div>
            </div>
            <button id="btnCloseAiModal" class="btn-modal-close" title="閉じる">✕</button>
          </div>

          <div class="studio-modal-body ai-modal-body">
            <!-- 左右2カラムレイアウト -->
            <div class="ai-modal-grid">
              <!-- 左カラム: 設定＆入力 -->
              <div class="ai-input-column">
                <!-- 1. Gemini API Key -->
                <div class="ai-form-group">
                  <div class="ai-label-row">
                    <label for="aiApiKeyInput"><strong>🔑 Gemini API キー:</strong></label>
                    <a href="https://aistudio.google.com/" target="_blank" rel="noopener" class="ai-link-help">APIキーを取得 (Google AI Studio) ↗</a>
                  </div>
                  <div class="ai-key-input-wrap">
                    <input type="password" id="aiApiKeyInput" class="studio-input" placeholder="AIzaSy..." autocomplete="off">
                    <button type="button" id="btnToggleApiKeyVis" class="btn-mini-tool" title="キーの表示/非表示">👁️</button>
                  </div>
                  <div class="ai-hint-text">※入力したAPIキーはブラウザのlocalStorageにのみ安全に保存され、外部サーバーには送信されません。</div>
                </div>

                <!-- 2. モデル選択 & ベース骨格リグ & 向き -->
                <div class="ai-form-row">
                  <div class="ai-form-group" style="flex: 1.1;">
                    <label for="aiModelSelect"><strong>🤖 使用モデル:</strong></label>
                    <select id="aiModelSelect" class="studio-select">
                      ${DEFAULT_MODELS.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="ai-form-group" style="flex: 1.4;">
                    <label for="aiBaseRigSelect"><strong>🦴 ベース骨格・アニメ (リグ):</strong></label>
                    <select id="aiBaseRigSelect" class="studio-select">
                      <option value="auto">✨ 自動判定 (プロンプト・種族から推定)</option>
                      <option value="hirame">🐟 ヒラメ型 (左向き魚類)</option>
                      <option value="karei">🐟 カレイ型 (右向き魚類)</option>
                      <option value="octopus">🐙 タコ型 (触手うねうね・墨噴射)</option>
                      <option value="squid">🦑 イカ型 (ロケット推進・墨噴射)</option>
                      <option value="stingray">🌊 エイ型 (大ヒレ波打ち)</option>
                      <option value="aji_open">🐟 アジの開き型 (干物骨格)</option>
                      <option value="shitabirame">👞 ウシノシタ型 (舌平目・砂底)</option>
                      <option value="human">🚶 人間型 (2足歩行・両腕両脚)</option>
                      <option value="quadruped">🐕 ４足歩行型 (4肢トロット・首・尾)</option>
                      <option value="biped">🦖 ２足歩行型 (怪獣・強靭脚・大尾)</option>
                      <option value="insect">🐝 昆虫型 (6本脚・高速羽ばたき)</option>
                      <option value="spider">🕷️ 蜘蛛型 (8本脚・波状這い)</option>
                      <option value="bird">🦅 鳥類型 (大羽ばたき・滑空)</option>
                    </select>
                  </div>
                  <div class="ai-form-group" style="width: 125px;">
                    <label for="aiFacingSelect"><strong>🧭 泳ぐ向き:</strong></label>
                    <select id="aiFacingSelect" class="studio-select">
                      <option value="-1">⬅ 左向き (ヒラメ系)</option>
                      <option value="1">右向き (カレイ系) ➡</option>
                    </select>
                  </div>
                </div>

                <!-- 3. 参考画像 (ドラッグ＆ドロップ / クリップボード / ファイル選択) -->
                <div class="ai-form-group">
                  <label><strong>🖼️ 参考画像 (任意・おすすめ):</strong></label>
                  <div id="aiImageDropzone" class="ai-dropzone">
                    <div id="aiDropzonePrompt" class="ai-dropzone-prompt">
                      <span class="ai-drop-icon">📁</span>
                      <span>ここに画像をドラッグ＆ドロップ、またはクリックして選択</span>
                      <span class="ai-drop-sub">（Ctrl+V でクリップボードから直接貼り付けも可能）</span>
                    </div>
                    <div id="aiImagePreviewWrap" class="ai-preview-wrap hidden">
                      <img id="aiImagePreview" src="" alt="参考画像プレビュー">
                      <button type="button" id="btnClearReferenceImage" class="btn-clear-img" title="参考画像を削除">✕ 削除</button>
                    </div>
                    <input type="file" id="aiFileInput" accept="image/*" style="display:none;">
                  </div>
                </div>

                <!-- 4. クイックプリセット＆プロンプト入力 -->
                <div class="ai-form-group">
                  <div class="ai-label-row">
                    <label for="aiPromptInput"><strong>💬 生成プロンプト (指示):</strong></label>
                    <span class="ai-chips-label">クイック選択:</span>
                  </div>
                  <div class="ai-chips-container">
                    <button type="button" class="ai-chip" data-prompt="堂々とした巨大なマッコウクジラ。背中に小さな潮吹き、深みのある藍色のボディ、白い腹部ライン、愛嬌のある目玉。">🐋 クジラ</button>
                    <button type="button" class="ai-chip" data-prompt="トゲトゲでパンパンに膨らんだトラフグ。黄色と茶色の斑点模様、小さなおちょぼ口、パッチリした大きな目。">🐡 フグ</button>
                    <button type="button" class="ai-chip" data-prompt="鋭い背びれとギザギザの牙を持つホオジロザメ。グレーの背中と白いお腹、獰猛だけどどこか可愛いコミカルな目。">🦈 サメ</button>
                    <button type="button" class="ai-chip" data-prompt="美しい甲羅模様を持つアオウミガメ。大きな前ヒレ、つぶらな瞳、のんびり泳ぐ優しいフォルム。">🐢 ウミガメ</button>
                    <button type="button" class="ai-chip" data-prompt="愛嬌のある口元と流線型の青い体を持つバンドウイルカ。背びれ、尾びれ、白いお腹。">🐬 イルカ</button>
                    <button type="button" class="ai-chip" data-prompt="真っ赤な甲羅と巨大なハサミ、長い触角を持つアメリカザリガニ/ロブスター。">🦞 ロブスター</button>
                    <button type="button" class="ai-chip" data-prompt="頭に提灯（発光器）をぶら下げた深海魚チョウチンアンコウ。大きく開いた口と鋭いキバ、怪しく光る目。">💡 アンコウ</button>
                  </div>
                  <textarea id="aiPromptInput" class="studio-textarea ai-prompt-textarea" rows="3" placeholder="例: クジラ作って！この参考画像みたいなシルエットで、ヒラメやカレイのような可愛い目玉と黒フチ線で、お腹にボーダー柄を入れて！"></textarea>
                </div>

                <!-- 生成実行ボタン -->
                <button type="button" id="btnRunAiGenerate" class="btn-action-ai-run">
                  <span class="ai-btn-icon">✨</span>
                  <span>Gemini AI でキャラクターを生成</span>
                </button>
              </div>

              <!-- 右カラム: プレビュー & 結果 -->
              <div class="ai-result-column">
                <div class="ai-result-card">
                  <div class="ai-result-header">
                    <h4>🔍 生成プレビュー</h4>
                    <span id="aiStatusBadge" class="ai-status-badge badge-idle">待機中</span>
                  </div>

                  <!-- SVGプレビュー画面 -->
                  <div class="ai-preview-stage-wrap">
                    <div id="aiPreviewStage" class="ai-preview-stage">
                      <svg id="aiPreviewSvg" viewBox="-120 -80 240 160" width="100%" height="100%">
                        <defs>
                          <pattern id="aiGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.8"/>
                          </pattern>
                        </defs>
                        <rect x="-120" y="-80" width="240" height="160" fill="url(#aiGrid)"/>
                        <!-- 中央基準線 -->
                        <line x1="-120" y1="0" x2="120" y2="0" stroke="rgba(56, 189, 248, 0.15)" stroke-width="0.8" stroke-dasharray="3 3"/>
                        <line x1="0" y1="-80" x2="0" y2="80" stroke="rgba(56, 189, 248, 0.15)" stroke-width="0.8" stroke-dasharray="3 3"/>
                        <g id="aiPreviewPartsGroup"></g>
                      </svg>
                    </div>

                    <!-- ローディング表示 -->
                    <div id="aiLoadingOverlay" class="ai-loading-overlay hidden">
                      <div class="ai-spinner"></div>
                      <div id="aiLoadingStepText" class="ai-loading-step">Gemini API へリクエスト送信中...</div>
                      <div class="ai-loading-sub">画像の解析とベクター造形を計算しています（約5〜15秒）</div>
                    </div>

                    <!-- エラー表示 -->
                    <div id="aiErrorOverlay" class="ai-error-overlay hidden">
                      <span class="ai-error-icon">⚠️</span>
                      <div id="aiErrorTitle" class="ai-error-title">生成に失敗しました</div>
                      <div id="aiErrorMessage" class="ai-error-msg"></div>
                      <button type="button" id="btnDismissError" class="tool-btn" style="margin-top:10px;">閉じる</button>
                    </div>
                  </div>

                  <!-- キャラクター情報 & パーツ詳細 -->
                  <div id="aiCharMetaCard" class="ai-char-meta hidden">
                    <div class="ai-meta-row">
                      <span class="ai-meta-name" id="aiGeneratedName">キャラクター名</span>
                      <span class="ai-meta-tag" id="aiGeneratedSpecies">種族: fish</span>
                      <span class="ai-meta-tag" id="aiGeneratedPartsCount">パーツ数: 0</span>
                    </div>
                    <div id="aiPartsListChips" class="ai-parts-chips"></div>
                  </div>

                  <!-- 適用・保存ボタン群 -->
                  <div class="ai-result-actions">
                    <button type="button" id="btnApplyAiToStudio" class="btn-action-primary" disabled>
                      🎨 スタジオに読み込んで編集
                    </button>
                    <button type="button" id="btnApplyAiToGame" class="btn-action-secondary" disabled>
                      🎮 そのままゲームに登録
                    </button>
                    <button type="button" id="btnDownloadAiJson" class="tool-btn" disabled>
                      💾 JSON保存
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml;
    document.body.appendChild(wrapper.firstElementChild);
    this.modal = document.getElementById('modalAiGenerator');
  }

  bindEvents() {
    if (!this.modal) return;

    // APIキーの初期反映
    const apiKeyInput = this.modal.querySelector('#aiApiKeyInput');
    if (apiKeyInput) {
      apiKeyInput.value = this.getApiKey();
      apiKeyInput.addEventListener('change', () => this.setApiKey(apiKeyInput.value));
      apiKeyInput.addEventListener('input', () => this.setApiKey(apiKeyInput.value));
    }

    // 表示切り替え
    this.modal.querySelector('#btnToggleApiKeyVis')?.addEventListener('click', () => {
      if (apiKeyInput) {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      }
    });

    // モデル選択
    const modelSelect = this.modal.querySelector('#aiModelSelect');
    if (modelSelect) {
      modelSelect.value = this.getSelectedModel();
      modelSelect.addEventListener('change', () => this.setSelectedModel(modelSelect.value));
    }

    // モーダル閉じる
    this.modal.querySelector('#btnCloseAiModal')?.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // 参考画像ドロップゾーン
    const dropzone = this.modal.querySelector('#aiImageDropzone');
    const fileInput = this.modal.querySelector('#aiFileInput');

    dropzone?.addEventListener('click', (e) => {
      if (e.target.id === 'btnClearReferenceImage') return;
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.loadReferenceFile(file);
    });

    // ドラッグ＆ドロップ
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.loadReferenceFile(file);
      }
    });

    // クリップボード貼り付け (Ctrl+V)
    window.addEventListener('paste', (e) => {
      if (!this.isOpen()) return;

      let imageFile = null;
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        for (const file of e.clipboardData.files) {
          if (file.type.startsWith('image/')) {
            imageFile = file;
            break;
          }
        }
      }
      if (!imageFile && e.clipboardData?.items) {
        for (const item of e.clipboardData.items) {
          if (item.type.indexOf('image') !== -1) {
            imageFile = item.getAsFile();
            if (imageFile) break;
          }
        }
      }

      if (imageFile) {
        e.preventDefault();
        e.stopPropagation();
        this.loadReferenceFile(imageFile);
        if (dropzone) {
          dropzone.classList.add('drag-over');
          setTimeout(() => dropzone.classList.remove('drag-over'), 350);
        }
      }
    }, true);

    // 参考画像クリア
    this.modal.querySelector('#btnClearReferenceImage')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearReferenceImage();
    });

    // クイックプロンプトチップ
    this.modal.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const promptInput = this.modal.querySelector('#aiPromptInput');
        if (promptInput) {
          promptInput.value = chip.dataset.prompt || '';
          promptInput.focus();
        }
      });
    });

    // 生成実行
    this.modal.querySelector('#btnRunAiGenerate')?.addEventListener('click', () => this.generate());

    // エラー解除
    this.modal.querySelector('#btnDismissError')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.modal.querySelector('#aiErrorOverlay')?.classList.add('hidden');
    });

    // 適用ボタン群
    this.modal.querySelector('#btnApplyAiToStudio')?.addEventListener('click', () => this.applyToStudio());
    this.modal.querySelector('#btnApplyAiToGame')?.addEventListener('click', () => this.applyToGame());
    this.modal.querySelector('#btnDownloadAiJson')?.addEventListener('click', () => this.downloadJson());
  }

  open() {
    if (!this.modal) return;
    const apiKeyInput = this.modal.querySelector('#aiApiKeyInput');
    if (apiKeyInput) {
      apiKeyInput.value = this.getApiKey();
    }
    // エラーとローディングのオーバーレイを初期化（確実に非表示）
    this.modal.querySelector('#aiErrorOverlay')?.classList.add('hidden');
    this.modal.querySelector('#aiLoadingOverlay')?.classList.add('hidden');
    this.modal.classList.remove('hidden');
  }

  close() {
    if (!this.modal) return;
    this.modal.querySelector('#aiErrorOverlay')?.classList.add('hidden');
    this.modal.querySelector('#aiLoadingOverlay')?.classList.add('hidden');
    this.modal.classList.add('hidden');
  }

  loadReferenceFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      const mimeType = file.type || 'image/png';
      const base64Data = url.split(',')[1];
      this.currentReferenceImage = {
        data: base64Data,
        mimeType: mimeType,
        url: url
      };

      const previewImg = this.modal.querySelector('#aiImagePreview');
      if (previewImg) previewImg.src = url;

      this.modal.querySelector('#aiDropzonePrompt')?.classList.add('hidden');
      this.modal.querySelector('#aiImagePreviewWrap')?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  clearReferenceImage() {
    this.currentReferenceImage = null;
    const previewImg = this.modal.querySelector('#aiImagePreview');
    if (previewImg) previewImg.src = '';
    const fileInput = this.modal.querySelector('#aiFileInput');
    if (fileInput) fileInput.value = '';

    this.modal.querySelector('#aiDropzonePrompt')?.classList.remove('hidden');
    this.modal.querySelector('#aiImagePreviewWrap')?.classList.add('hidden');
  }

  async generate() {
    if (this.isGenerating) return;

    const apiKey = this.getApiKey();
    if (!apiKey) {
      alert('Gemini API キーを入力してください。\n（Google AI Studio から無料で即時取得可能です）');
      this.modal.querySelector('#aiApiKeyInput')?.focus();
      return;
    }

    const promptText = (this.modal.querySelector('#aiPromptInput')?.value || '').trim();
    if (!promptText && !this.currentReferenceImage) {
      alert('プロンプト（指示テキスト）を入力するか、参考画像をアップロードしてください。');
      this.modal.querySelector('#aiPromptInput')?.focus();
      return;
    }

    const model = this.getSelectedModel();
    const facing = parseInt(this.modal.querySelector('#aiFacingSelect')?.value || '-1', 10);
    const baseRig = this.modal.querySelector('#aiBaseRigSelect')?.value || 'auto';

    this.isGenerating = true;
    this.setUiState('generating', 'Gemini API へリクエスト送信中...');

    try {
      const character = await this.callGeminiApi({
        apiKey,
        model,
        prompt: promptText,
        referenceImage: this.currentReferenceImage,
        facing,
        baseRig
      });

      this.generatedCharacter = character;
      this.renderPreview(character);
      this.setUiState('success');
    } catch (err) {
      console.error('AI Character generation error:', err);
      this.setUiState('error', err.message || '生成処理中にエラーが発生しました。');
    } finally {
      this.isGenerating = false;
    }
  }

  async callGeminiApi({ apiKey, model, prompt, referenceImage, facing, baseRig }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let rigGuidance = '';
    if (baseRig === 'human') {
      rigGuidance = '\n【骨格パーツ構成の指定】人間型(human)として設計してください。推奨部位: 胴体(body), 頭部(head), 両腕(arm), 両脚(leg), 目玉(eyes), 口(mouth)。';
    } else if (baseRig === 'quadruped') {
      rigGuidance = '\n【骨格パーツ構成の指定】4足歩行動物型(quadruped)として設計してください。推奨部位: 胴体(body), 首(neck), 頭部(head), 尻尾(tail), 前肢(leg), 後肢(leg), 耳, 目玉(eyes)。';
    } else if (baseRig === 'biped') {
      rigGuidance = '\n【骨格パーツ構成の指定】2足歩行怪獣/恐竜型(biped)として設計してください。推奨部位: 胴体(body), 胸部, 頭部(head), 開閉下顎(mouth), 大尻尾(tail), 前肢(arm), 太もも・すね(leg)。';
    } else if (baseRig === 'insect') {
      rigGuidance = '\n【骨格パーツ構成の指定】昆虫型(insect)として設計してください。推奨部位: 胸部(body), 腹部(body), 頭部(head), 角/触角(decoration), 複眼(eyes), 羽(fin_dorsal), 6本脚(leg)。';
    } else if (baseRig === 'spider') {
      rigGuidance = '\n【骨格パーツ構成の指定】蜘蛛型(spider)として設計してください。推奨部位: 頭胸部(body), 腹部(body), 毒牙(mouth), 複眼(eyes), 8本の脚(leg)。';
    } else if (baseRig === 'bird') {
      rigGuidance = '\n【骨格パーツ構成の指定】鳥類型(bird)として設計してください。推奨部位: 胴体(body), 頭部(head), くちばし(mouth), 広大な翼(fin_dorsal/fin_pectoral), 尾羽(fin_tail), 目玉(eyes)。';
    } else if (baseRig === 'stingray') {
      rigGuidance = '\n【骨格パーツ構成の指定】エイ型(stingray)として設計してください。推奨部位: 扁平な大ヒレ胴体(body), 長い尾針(tail/fin_tail), 目玉(eyes)。';
    } else if (baseRig === 'octopus') {
      rigGuidance = '\n【骨格パーツ構成の指定】タコ型(octopus)として設計してください。推奨部位: 丸い頭部(body), 8本のうねる触手(fin_tail/body), 目玉(eyes)。';
    } else if (baseRig === 'squid') {
      rigGuidance = '\n【骨格パーツ構成の指定】イカ型(squid)として設計してください。推奨部位: 三角エンペラ, 流線型胴体(body), 触腕, 目玉(eyes)。';
    }

    const systemInstruction = `
あなたは2Dアクションゲーム「ヒラメいた！」のプロのキャラクターデザイナーおよびベクターアニメーションエンジニアです。
ユーザーから提供された参考画像やテキストプロンプト（例：「クジラ作って！この画像みたいに！」）をもとに、当ゲームの世界観・デザインテイストに完全に合致するオリジナルキャラクターのベクターパーツ構造（JSON）を設計して出力してください。
${rigGuidance}

【デザインの絶対原則】
1. テイスト:
   - 洗練されたポップで愛嬌のある2Dフラットイラストテイスト。
   - すべてのパーツは明確な黒フチ線（stroke: "#1c1814", strokeWidth: 2.8）で縁取られます。
   - 体色は鮮やかかつ品のある配色（ベースカラー、腹部やヒレのアクセントカラー、斑点や模様）。
2. 目玉（アイデザイン）:
   - ヒラメやカレイのように、眼窩ソケット（濃色リング）＋白目（#f8fafc）＋黒目瞳（#0f172a）の2〜3層構造。
   - 愛嬌があり、少しとぼけた表情や可愛いハイライトが魅力です。
   - 目玉は2つ設置（背側の上部目玉と、顔前面の下部目玉）するとゲーム全体のデザインと綺麗に統一されます。
3. パーツ分割とレイヤー階層 (zIndex):
   - アニメーションできるように各部位を個別のパーツに分割してください。
   - 推奨レイヤー構成 (zIndex 昇順):
     - 尾びれ/尻尾 (fin_tail / tail): zIndex: 1
     - 背びれ/羽 (fin_dorsal): zIndex: 2
     - 腹びれ (fin_ventral): zIndex: 2
     - 本体/胴体 (body): zIndex: 3
     - 腹部パターン/装飾 (decoration): zIndex: 4
     - 胸びれ/腕/脚 (fin_pectoral / arm / leg): zIndex: 5
     - 目玉ソケット (eyes): zIndex: 6
     - 白目 (eyes): zIndex: 7
     - 黒目瞳 (eyes): zIndex: 8
     - 口/キバ (mouth): zIndex: 9
4. 座標系（原点 (0, 0) がキャラクターの中心）:
   - 全体サイズ目安: 幅 160〜220、高さ 80〜140 程度。
   - x座標: -100 〜 +100
   - y座標: -60 〜 +60
   - facing が -1 (左向き) の場合: 頭部・顔はマイナスX側（例: x: -50〜-70）、尾びれはプラスX側（例: x: +60〜+85）。
   - facing が 1 (右向き) の場合: 頭部・顔はプラスX側、尾びれはマイナスX側。
5. ベジエ曲線ポイント:
   - 各パーツは4〜12個のポイントを持つ closed: true な滑らかな曲線。
   - 各ポイントは { "x": 数値, "y": 数値, "type": "smooth" または "corner" }。
   - ハンドル(inHandle, outHandle)は指定しても良いですし、省略された場合もシステム側で自動Catmull-Rom平滑化補間されます。

【出力JSONスキーマ】
マークダウンコードブロックは含めず、以下のJSONフォーマットで直接返答してください:
{
  "id": "英数字アンダースコア（例: whale, puffer, shark）",
  "name": "日本語キャラクター名（例: クジラ, トゲトゲフグ）",
  "species": "fish" または "octopus" または "squid" または "ray" または "other",
  "facing": ${facing},
  "parts": [
    {
      "id": "ユニークなパーツID（例: whale_tail）",
      "name": "日本語パーツ名（例: 尾びれ）",
      "type": "body" | "fin_tail" | "fin_dorsal" | "fin_ventral" | "fin_pectoral" | "eyes" | "mouth" | "decoration",
      "parentId": null,
      "zIndex": 1,
      "pivot": { "x": 0, "y": 0 },
      "closed": true,
      "points": [
        { "x": 45, "y": -8, "type": "corner" },
        { "x": 85, "y": -26, "type": "corner" },
        { "x": 90, "y": 0, "type": "smooth" },
        { "x": 85, "y": 26, "type": "corner" },
        { "x": 45, "y": 8, "type": "corner" }
      ],
      "style": {
        "fill": "#3b82f6",
        "stroke": "#0f172a",
        "strokeWidth": 2.8,
        "opacity": 1.0
      }
    }
  ]
}
`;

    // ユーザーコンテンツ構築
    const parts = [];
    if (referenceImage && referenceImage.data) {
      parts.push({
        inlineData: {
          mimeType: referenceImage.mimeType,
          data: referenceImage.data
        }
      });
      parts.push({
        text: `【添付画像について】
この添付画像を参考にして、画像に写っている生物の特徴（フォルム、輪郭、ヒレ、模様、質感）を捉え、当ゲームの2Dベクターキャラクターとしてパーツ分割して再構築してください。
向きは facing: ${facing} (${facing === -1 ? '左向き' : '右向き'}) に合わせてください。`
      });
    }

    const userInstruction = prompt || '添付画像をもとにゲーム用キャラクターを設計してください。';
    parts.push({
      text: `【ユーザーの要望・指示】\n${userInstruction}\n\n必ず指定のJSONスキーマに従ってJSONを出力してください。`
    });

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    };

    this.setUiState('generating', 'Gemini が画像を解析してベクターパーツを計算中...');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson.error?.message || response.statusText;
      } catch (_) {
        errDetail = response.statusText;
      }
      if (response.status === 400 && errDetail.includes('API_KEY_INVALID')) {
        throw new Error('APIキーが無効です。Google AI Studio で正しいキーを確認してください。');
      }
      if (response.status === 429) {
        throw new Error('APIの利用制限（クォータ）に達しました。数十秒待ってから再試行してください。');
      }
      throw new Error(`Gemini API エラー (${response.status}): ${errDetail}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('Gemini からの応答が空でした。プロンプトを変えて再試行してください。');
    }

    const textContent = candidate.content?.parts?.map(p => p.text).join('') || '';
    if (!textContent) {
      throw new Error('Gemini の出力テキストが空でした。');
    }

    // JSON パース
    let cleanedJson = textContent.trim();
    if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (parseErr) {
      console.error('JSON Parse error on text:', cleanedJson);
      throw new Error(`Gemini の出力をJSONとして解析できませんでした: ${parseErr.message}`);
    }

    return this.postProcessCharacter(parsed, facing, baseRig);
  }

  postProcessCharacter(rawChar, targetFacing, baseRig = 'auto') {
    const char = {
      id: rawChar.id || `ai_${Date.now()}`,
      name: rawChar.name || 'AI生成キャラ',
      species: rawChar.species || 'fish',
      facing: targetFacing || rawChar.facing || -1,
      parts: []
    };

    if (!Array.isArray(rawChar.parts) || rawChar.parts.length === 0) {
      throw new Error('キャラクターのパーツデータが含まれていませんでした。');
    }

    // パーツ補正
    char.parts = rawChar.parts.map((rawPart, idx) => {
      const points = (rawPart.points || []).map(p => ({
        x: Math.round((p.x || 0) * 10) / 10,
        y: Math.round((p.y || 0) * 10) / 10,
        type: p.type === 'corner' ? 'corner' : 'smooth',
        inHandle: p.inHandle ? { x: Math.round(p.inHandle.x * 10) / 10, y: Math.round(p.inHandle.y * 10) / 10 } : null,
        outHandle: p.outHandle ? { x: Math.round(p.outHandle.x * 10) / 10, y: Math.round(p.outHandle.y * 10) / 10 } : null
      }));

      // ハンドルが未定義の場合は自動的にCatmull-Rom補間を走らせる
      const needsHandles = points.some(p => !p.inHandle || !p.outHandle || (p.inHandle.x === p.x && p.inHandle.y === p.y));
      if (needsHandles && points.length > 2) {
        computeCurvatureHandles(points, rawPart.closed !== false);
      }

      // ピボット中心点計算
      let pivot = rawPart.pivot;
      if (!pivot && points.length > 0) {
        const avgX = points.reduce((acc, p) => acc + p.x, 0) / points.length;
        const avgY = points.reduce((acc, p) => acc + p.y, 0) / points.length;
        pivot = { x: Math.round(avgX), y: Math.round(avgY) };
      }

      const style = rawPart.style || {};

      return {
        id: rawPart.id || `ai_part_${idx + 1}`,
        name: rawPart.name || `パーツ ${idx + 1}`,
        type: rawPart.type || 'body',
        parentId: rawPart.parentId || null,
        zIndex: typeof rawPart.zIndex === 'number' ? rawPart.zIndex : idx + 1,
        pivot: pivot || { x: 0, y: 0 },
        visible: rawPart.visible !== false,
        closed: rawPart.closed !== false,
        locked: false,
        points: points,
        style: {
          fill: style.fill || '#38bdf8',
          stroke: style.stroke || '#0f172a',
          strokeWidth: typeof style.strokeWidth === 'number' ? style.strokeWidth : 2.8,
          opacity: typeof style.opacity === 'number' ? style.opacity : 1.0,
          strokePosition: style.strokePosition || 'center'
        }
      };
    });

    // zIndex でソート
    char.parts.sort((a, b) => a.zIndex - b.zIndex);

    // 骨格リグとアニメーションの自動適用
    let rigKey = baseRig;
    if (!rigKey || rigKey === 'auto') {
      const text = ((rawChar.name || '') + ' ' + (rawChar.species || '') + ' ' + (rawChar.id || '')).toLowerCase();
      if (text.includes('鳥') || text.includes('bird') || text.includes('ワシ') || text.includes('カモメ')) rigKey = 'bird';
      else if (text.includes('蜘蛛') || text.includes('spider') || text.includes('クモ')) rigKey = 'spider';
      else if (text.includes('昆虫') || text.includes('insect') || text.includes('蜂') || text.includes('カブト')) rigKey = 'insect';
      else if (text.includes('人間') || text.includes('human') || text.includes('男') || text.includes('女') || text.includes('人')) rigKey = 'human';
      else if (text.includes('四足') || text.includes('4足') || text.includes('quad') || text.includes('犬') || text.includes('猫') || text.includes('馬')) rigKey = 'quadruped';
      else if (text.includes('恐竜') || text.includes('二足') || text.includes('2足') || text.includes('怪獣') || text.includes('biped')) rigKey = 'biped';
      else if (text.includes('エイ') || text.includes('ray')) rigKey = 'stingray';
      else if (text.includes('タコ') || text.includes('octopus')) rigKey = 'octopus';
      else if (text.includes('イカ') || text.includes('squid')) rigKey = 'squid';
      else if (text.includes('干物') || text.includes('開き')) rigKey = 'aji_open';
      else if (text.includes('ウシノシタ') || text.includes('舌平目')) rigKey = 'shitabirame';
      else rigKey = targetFacing === 1 ? 'karei' : 'hirame';
    }

    const basePresetFn = BASE_PRESETS[rigKey] || BASE_PRESETS.hirame;
    const basePreset = basePresetFn();

    // アニメーションをコピーして生成パーツに適合
    char.animations = {};
    if (basePreset.animations) {
      for (const [motionId, animClip] of Object.entries(basePreset.animations)) {
        const newTracks = {};
        const baseTracks = animClip.tracks || {};
        const basePartIds = Object.keys(baseTracks);

        for (const genPart of char.parts) {
          let matchedBaseId = basePartIds.find(bId => {
            const bPart = basePreset.parts.find(p => p.id === bId);
            return bPart && bPart.type === genPart.type;
          });
          if (!matchedBaseId) {
            matchedBaseId = basePartIds.find(bId => {
              const bPart = basePreset.parts.find(p => p.id === bId);
              return bPart && (bPart.name.includes(genPart.name) || genPart.name.includes(bPart.name));
            });
          }
          if (matchedBaseId && baseTracks[matchedBaseId]) {
            newTracks[genPart.id] = JSON.parse(JSON.stringify(baseTracks[matchedBaseId]));
          }
        }

        // フォールバック（本体に少しアニメをつける）
        if (Object.keys(newTracks).length === 0 && char.parts.length > 0) {
          const mainPart = char.parts.find(p => p.type === 'body') || char.parts[0];
          newTracks[mainPart.id] = [
            { time: 0.0, ty: 0, rot: 0 },
            { time: animClip.duration * 0.5, ty: -3, rot: 2 },
            { time: animClip.duration, ty: 0, rot: 0 }
          ];
        }

        char.animations[motionId] = {
          id: animClip.id,
          name: animClip.name,
          duration: animClip.duration,
          loop: animClip.loop !== false,
          tracks: newTracks
        };
      }
    }

    // 部位構成やパーツ構成で自動的に既存のものと同じモーション（4種類: swim, idle, flee, angry）を補完搭載
    const defaultRigAnims = generateDefaultRigAnimations(char.parts, char.species);
    if (!char.animations || Object.keys(char.animations).length === 0) {
      char.animations = defaultRigAnims;
    } else {
      for (const [motionId, defClip] of Object.entries(defaultRigAnims)) {
        if (!char.animations[motionId]) {
          char.animations[motionId] = defClip;
        } else {
          // 未割り当てのパーツトラックを補完
          char.animations[motionId].tracks = {
            ...defClip.tracks,
            ...char.animations[motionId].tracks
          };
        }
      }
    }

    return char;
  }

  renderPreview(character) {
    const svgGroup = this.modal.querySelector('#aiPreviewPartsGroup');
    if (!svgGroup) return;
    svgGroup.innerHTML = '';

    if (!character || !character.parts) return;

    for (const part of character.parts) {
      if (!part.visible) continue;
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = pointsToSvgPath(part.points, part.closed);
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('fill', part.style.fill || 'none');
      pathEl.setAttribute('stroke', part.style.stroke || 'none');
      pathEl.setAttribute('stroke-width', (part.style.strokeWidth || 0).toString());
      pathEl.setAttribute('opacity', (part.style.opacity ?? 1).toString());
      pathEl.setAttribute('stroke-linejoin', 'round');
      pathEl.setAttribute('stroke-linecap', 'round');
      svgGroup.appendChild(pathEl);
    }

    // メタ情報更新
    const nameEl = this.modal.querySelector('#aiGeneratedName');
    if (nameEl) nameEl.textContent = `✨ ${character.name}`;

    const speciesEl = this.modal.querySelector('#aiGeneratedSpecies');
    if (speciesEl) speciesEl.textContent = `種族: ${character.species || 'fish'}`;

    const partsCountEl = this.modal.querySelector('#aiGeneratedPartsCount');
    if (partsCountEl) partsCountEl.textContent = `パーツ数: ${character.parts.length}個`;

    // チップ一覧
    const chipsContainer = this.modal.querySelector('#aiPartsListChips');
    if (chipsContainer) {
      chipsContainer.innerHTML = character.parts.map(p => `
        <span class="ai-part-badge" style="border-left: 3px solid ${p.style.fill || '#38bdf8'}">
          ${p.name} (${p.type})
        </span>
      `).join('');
    }

    this.modal.querySelector('#aiCharMetaCard')?.classList.remove('hidden');

    // 適用ボタン有効化
    this.modal.querySelector('#btnApplyAiToStudio').disabled = false;
    this.modal.querySelector('#btnApplyAiToGame').disabled = false;
    this.modal.querySelector('#btnDownloadAiJson').disabled = false;
  }

  setUiState(state, message = '') {
    const loadingOverlay = this.modal.querySelector('#aiLoadingOverlay');
    const errorOverlay = this.modal.querySelector('#aiErrorOverlay');
    const statusBadge = this.modal.querySelector('#aiStatusBadge');
    const loadingStepText = this.modal.querySelector('#aiLoadingStepText');
    const runBtn = this.modal.querySelector('#btnRunAiGenerate');

    if (state === 'generating') {
      loadingOverlay?.classList.remove('hidden');
      errorOverlay?.classList.add('hidden');
      if (loadingStepText) loadingStepText.textContent = message;
      if (statusBadge) {
        statusBadge.className = 'ai-status-badge badge-generating';
        statusBadge.textContent = '⚡ 生成中...';
      }
      if (runBtn) runBtn.disabled = true;
    } else if (state === 'success') {
      loadingOverlay?.classList.add('hidden');
      errorOverlay?.classList.add('hidden');
      if (statusBadge) {
        statusBadge.className = 'ai-status-badge badge-success';
        statusBadge.textContent = '✓ 生成完了';
      }
      if (runBtn) runBtn.disabled = false;
    } else if (state === 'error') {
      loadingOverlay?.classList.add('hidden');
      errorOverlay?.classList.remove('hidden');
      const errMsgEl = this.modal.querySelector('#aiErrorMessage');
      if (errMsgEl) errMsgEl.textContent = message;
      if (statusBadge) {
        statusBadge.className = 'ai-status-badge badge-error';
        statusBadge.textContent = '✕ エラー';
      }
      if (runBtn) runBtn.disabled = false;
    } else {
      loadingOverlay?.classList.add('hidden');
      errorOverlay?.classList.add('hidden');
      if (statusBadge) {
        statusBadge.className = 'ai-status-badge badge-idle';
        statusBadge.textContent = '待機中';
      }
      if (runBtn) runBtn.disabled = false;
    }
  }

  applyToStudio() {
    if (!this.generatedCharacter) return;
    const char = JSON.parse(JSON.stringify(this.generatedCharacter));

    // スタジオアプリに反映
    this.studioApp.character = char;
    this.studioApp.editor.setCharacter(char);
    this.studioApp.renderLayerTree();
    this.studioApp.renderInspector();
    this.studioApp.renderTimeline();
    this.studioApp.updateInspectorPreview();

    this.close();
    alert(`🎉 「${char.name}」をキャラクタースタジオに読み込みました！\nキャンバス上で頂点を自由に微調整したり、アニメーションをプレビューできます。`);
  }

  applyToGame() {
    if (!this.generatedCharacter) return;
    const char = JSON.parse(JSON.stringify(this.generatedCharacter));
    const newId = char.id.startsWith('custom_') ? char.id : `custom_${Date.now()}`;
    char.id = newId;

    const roster = this.studioApp.getRoster();
    roster[newId] = char;
    this.studioApp.saveRoster(roster);
    this.studioApp.updatePresetSelectOptions();

    // スタジオにも展開
    this.studioApp.character = char;
    this.studioApp.editor.setCharacter(char);
    this.studioApp.renderLayerTree();
    this.studioApp.renderInspector();
    this.studioApp.renderTimeline();
    this.studioApp.updateInspectorPreview();

    this.close();
    alert(`🎮 「${char.name}」をゲームロスターに新規登録し、即時反映しました！\nゲーム画面を開くと、新キャラクターが登場します。`);
  }

  downloadJson() {
    if (!this.generatedCharacter) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.generatedCharacter, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${this.generatedCharacter.id || 'ai_character'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
