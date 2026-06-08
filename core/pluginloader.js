const fs = require('fs');
const path = require('path');

class PluginLoader {
    constructor(app, db, pluginConfig) {
        this.app = app;
        this.db = db;
        this.config = pluginConfig;
        this.loadedPlugins = new Map();
        this.failedPlugins = [];
        this.pluginHooks = new Map();
        
        console.log('\n🔧 Plugin Loader Initialized');
        console.log(`📋 Core Version: ${pluginConfig.core?.version || 'unknown'}`);
    }

    loadAll() {
        console.log('\n' + '='.repeat(50));
        console.log('🔌 PLUGIN LOADING PROCESS STARTED');
        console.log('='.repeat(50));
        
        const plugins = this.config.plugins || [];
        
        if (plugins.length === 0) {
            console.log('📭 No plugins configured');
            return;
        }

        console.log(`📦 Total plugins in config: ${plugins.length}\n`);

        plugins.forEach(plugin => {
            this.loadPlugin(plugin);
        });

        this.printSummary();
        
        console.log('='.repeat(50));
        console.log('✅ PLUGIN LOADING COMPLETED');
        console.log('='.repeat(50) + '\n');
    }

    loadPlugin(plugin) {
        try {
            if (!plugin.enabled) {
                console.log(`⏸️  Plugin "${plugin.name}" is disabled (skipping)`);
                return;
            }

            console.log(`📂 Loading plugin: ${plugin.name} v${plugin.version || '1.0.0'}`);
            console.log(`   📍 Path: ${plugin.path}`);

            const pluginPath = path.join(process.cwd(), plugin.path);
            
            if (!fs.existsSync(pluginPath)) {
                throw new Error(`Plugin path does not exist: ${pluginPath}`);
            }

            const manifestPath = path.join(pluginPath, 'manifest.json');
            const indexPath = path.join(pluginPath, 'index.js');

            if (!fs.existsSync(indexPath)) {
                throw new Error(`Plugin index.js not found at ${indexPath}`);
            }

            // Load manifest if exists
            let manifest = null;
            if (fs.existsSync(manifestPath)) {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                console.log(`   📋 Manifest: ${manifest.description || 'No description'}`);
            }

            // Clear cache for fresh load
            if (require.cache[require.resolve(indexPath)]) {
                delete require.cache[require.resolve(indexPath)];
            }

            // Load plugin module
            const pluginModule = require(indexPath);

            if (typeof pluginModule.init !== 'function') {
                throw new Error('Plugin must export an init function');
            }

            // Check dependencies
            if (plugin.dependencies && plugin.dependencies.length > 0) {
                console.log(`   🔗 Dependencies: ${plugin.dependencies.join(', ')}`);
                this.checkDependencies(plugin.dependencies);
            }

            // Container for plugin
            const container = {
                db: this.db,
                app: this.app,
                config: plugin,
                coreVersion: this.config.core?.version,
                logger: console,
                hooks: this.pluginHooks
            };

            console.log(`   ⚙️  Initializing...`);
            const instance = pluginModule.init(container);

            // Store plugin instance
            this.loadedPlugins.set(plugin.name, {
                instance,
                config: plugin,
                manifest,
                loadedAt: new Date().toISOString(),
                routes: instance.routes || []
            });

            // Register hooks
            if (instance.hooks && typeof instance.hooks === 'object') {
                Object.keys(instance.hooks).forEach(hookName => {
                    if (!this.pluginHooks.has(hookName)) {
                        this.pluginHooks.set(hookName, []);
                    }
                    this.pluginHooks.get(hookName).push({
                        plugin: plugin.name,
                        handler: instance.hooks[hookName]
                    });
                });
                console.log(`   🪝  Hooks registered: ${Object.keys(instance.hooks).length}`);
            }

            console.log(`   ✅ Plugin "${plugin.name}" loaded successfully\n`);

        } catch (error) {
            console.error(`   ❌ Failed to load plugin "${plugin.name}":`, error.message);
            this.failedPlugins.push({
                name: plugin.name,
                error: error.message
            });
            console.log('');
        }
    }

    checkDependencies(dependencies) {
        const missing = [];
        
        dependencies.forEach(dep => {
            if (!this.loadedPlugins.has(dep) && dep !== 'database' && dep !== 'auth') {
                missing.push(dep);
            }
        });

        if (missing.length > 0) {
            console.warn(`   ⚠️  Missing dependencies: ${missing.join(', ')}`);
        }
    }

    printSummary() {
        console.log('\n📊 PLUGIN LOADING SUMMARY');
        console.log('-'.repeat(40));
        console.log(`✅ Successfully loaded: ${this.loadedPlugins.size}`);
        console.log(`❌ Failed to load: ${this.failedPlugins.length}`);
        
        if (this.loadedPlugins.size > 0) {
            console.log('\n📦 Loaded Plugins:');
            this.loadedPlugins.forEach((value, key) => {
                console.log(`   • ${key} v${value.config.version || '1.0.0'}`);
            });
        }
        
        if (this.failedPlugins.length > 0) {
            console.log('\n❌ Failed Plugins:');
            this.failedPlugins.forEach(f => {
                console.log(`   • ${f.name}: ${f.error}`);
            });
        }
        console.log('-'.repeat(40));
    }

    disablePlugin(pluginName) {
        if (this.loadedPlugins.has(pluginName)) {
            const plugin = this.loadedPlugins.get(pluginName);
            
            console.log(`\n🔌 Disabling plugin: ${pluginName}`);
            
            if (plugin.instance && typeof plugin.instance.cleanup === 'function') {
                try {
                    plugin.instance.cleanup();
                    console.log(`   ✅ Cleanup completed`);
                } catch (error) {
                    console.error(`   ❌ Cleanup failed:`, error.message);
                }
            }

            // Remove hooks
            this.pluginHooks.forEach((handlers, hookName) => {
                this.pluginHooks.set(
                    hookName, 
                    handlers.filter(h => h.plugin !== pluginName)
                );
            });

            this.loadedPlugins.delete(pluginName);
            console.log(`   ✅ Plugin "${pluginName}" disabled\n`);
            return true;
        }
        return false;
    }

    enablePlugin(pluginName) {
        const plugin = this.config.plugins.find(p => p.name === pluginName);
        
        if (!plugin) {
            console.log(`❌ Plugin "${pluginName}" not found in config\n`);
            return false;
        }

        this.loadPlugin(plugin);
        return true;
    }

    isPluginLoaded(pluginName) {
        return this.loadedPlugins.has(pluginName);
    }

    listPlugins() {
        const plugins = [];
        this.loadedPlugins.forEach((value, key) => {
            plugins.push({
                name: key,
                version: value.config.version,
                loadedAt: value.loadedAt
            });
        });
        return plugins;
    }

    getPlugin(pluginName) {
        const plugin = this.loadedPlugins.get(pluginName);
        return plugin ? plugin.instance : null;
    }

    async triggerHook(hookName, data) {
        const hooks = this.pluginHooks.get(hookName) || [];
        
        if (hooks.length > 0) {
            console.log(`🪝 Triggering hook: ${hookName} (${hooks.length} handlers)`);
            
            for (const hook of hooks) {
                try {
                    await hook.handler(data);
                } catch (error) {
                    console.error(`   ❌ Hook ${hookName} from ${hook.plugin} failed:`, error.message);
                }
            }
        }
    }
}

module.exports = PluginLoader;