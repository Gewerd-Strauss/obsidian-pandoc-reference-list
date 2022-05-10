import {
  ItemView,
  MarkdownView,
  TFile,
  WorkspaceLeaf,
  setIcon,
} from 'obsidian';

import { t } from './lang/helpers';
import ReferenceList from './main';
import { ViewManager } from './viewManager';

export const viewType = 'ReferenceListView';

export class ReferenceListView extends ItemView {
  plugin: ReferenceList;
  activeMarkdownLeaf: MarkdownView;
  viewManager: ViewManager;

  async onClose() {
    this.viewManager.cache.clear();
    this.plugin.emitter.off('ready', this.processReferences);
    this.plugin.emitter.off('settingsUpdated', this.handleSettingsUpdate);
    return super.onClose();
  }

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);

    this.plugin = plugin;
    this.viewManager = new ViewManager(plugin);

    this.registerEvent(
      app.metadataCache.on('changed', (file) => {
        if (this.plugin.isReady) {
          const activeView = app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView && file === activeView.file) {
            this.processReferences();
          }
        }
      })
    );

    this.registerEvent(
      app.workspace.on('active-leaf-change', (leaf) => {
        if (this.plugin.isReady) {
          if (leaf && leaf.view instanceof MarkdownView) {
            this.processReferences();
          } else {
            this.setNoContentMessage();
          }
        }
      })
    );

    if (this.plugin.isReady) {
      this.processReferences();
    }

    this.plugin.emitter.on('ready', this.processReferences);
    this.plugin.emitter.on('settingsUpdated', this.handleSettingsUpdate);
    this.contentEl.addClass('pwc-reference-list');
    this.contentEl.toggleClass(
      'collapsed-links',
      !!this.plugin.settings.hideLinks
    );
  }

  handleSettingsUpdate = () => {
    if (this.plugin.isReady) {
      this.contentEl.toggleClass(
        'collapsed-links',
        !!this.plugin.settings.hideLinks
      );

      this.processReferences();
    }
  };

  processReferences = () => {
    if (!this.plugin.settings.pathToPandoc) {
      return this.setMessage(
        t(
          'Please provide the path to pandoc in the Pandoc Reference List plugin settings.'
        )
      );
    }

    if (!this.plugin.settings.pathToBibliography) {
      return this.setMessage(
        'Please provide the path to your pandoc compatible bibliography file in the Pandoc Reference List plugin settings.'
      );
    }

    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    if (activeView) {
      app.vault.cachedRead(activeView.file).then((content) => {
        this.viewManager
          .getReferenceList(activeView.file, content)
          .then((bib) => {
            this.setViewContent(activeView.file, bib);
          });
      });
    } else {
      this.setNoContentMessage();
    }
  };

  setViewContent(file: TFile, bib: HTMLElement) {
    if (bib && this.contentEl.firstChild !== bib) {
      if (this.plugin.settings.hideLinks) {
        bib.findAll('a').forEach((l) => {
          l.setAttribute('aria-label', l.innerText);
        });
      }

      bib.findAll('.csl-entry').forEach((e) => {
        e.setAttribute('aria-label', t('Click to copy'));
        e.dataset.source = file.path;

        const leafRoot = this.leaf.getRoot();
        if (leafRoot) {
          const tooltipPos =
            (leafRoot as any).side === 'right' ? 'left' : 'right';
          e.setAttribute('aria-label-position', tooltipPos);
        }
      });

      this.contentEl.empty();
      this.contentEl.createDiv(
        {
          cls: 'pwc-reference-list__title',
        },
        (div) => {
          div.createDiv({ text: this.getDisplayText() });
          setIcon(
            div.createDiv({
              cls: 'pwc-copy-list',
              attr: {
                'aria-label': t('Copy list'),
                'data-source': file.path,
              },
            }),
            'select-all-text'
          );
        }
      );
      this.contentEl.append(bib);
    } else if (!bib) {
      this.setNoContentMessage();
    }
  }

  setNoContentMessage() {
    this.setMessage(t('No citations found in the active document.'));
  }

  setMessage(message: string) {
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: 'pwc-no-content',
      text: message,
    });
  }

  getViewType() {
    return viewType;
  }

  getDisplayText() {
    return t('References');
  }

  getIcon() {
    return 'quote-glyph';
  }
}
