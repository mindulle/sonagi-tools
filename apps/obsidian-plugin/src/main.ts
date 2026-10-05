import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

interface SonagiPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: SonagiPluginSettings = {
  mySetting: 'default',
};

export default class SonagiPlugin extends Plugin {
  settings: SonagiPluginSettings;

  async onload() {
    await this.loadSettings();
    console.log('Loading Sonagi Plugin');

    // Ribbon icon in the left sidebar
    const ribbonIconEl = this.addRibbonIcon('dice', 'Sonagi Plugin', (_evt: MouseEvent) => {
      new Notice('Hello from Sonagi Tools!');
    });
    ribbonIconEl.addClass('sonagi-plugin-ribbon-class');

    // A simple command
    this.addCommand({
      id: 'sonagi-say-hello',
      name: 'Say Hello',
      callback: () => {
        new Notice('Hello! The plugin is working.');
      },
    });

    // Settings tab
    this.addSettingTab(new SonagiSettingTab(this.app, this));
  }

  onunload() {
    console.log('Unloading Sonagi Plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SonagiSettingTab extends PluginSettingTab {
  plugin: SonagiPlugin;

  constructor(app: App, plugin: SonagiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Sample Setting')
      .setDesc('It is a secret')
      .addText((text) =>
        text
          .setPlaceholder('Enter your secret')
          .setValue(this.plugin.settings.mySetting)
          .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
