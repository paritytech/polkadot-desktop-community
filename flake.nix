{
  description = "Polkadot Desktop - Electron app for browsing Polkadot products";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_24;
          electron = pkgs.electron_39;
        in
        {
          default = pkgs.buildNpmPackage {
            pname = "polkadot-desktop";
            version = "0.1.0";

            src = ./.;

            inherit nodejs;

            npmDepsHash = "sha256-eSlSeCH1PVCL9l5HrmPYQm6MeM88oZ6+EPaT3HfiwwA=";

            npmDepsFetcherVersion = 2;
            makeCacheWritable = true;

            nativeBuildInputs = with pkgs; [
              makeWrapper
              python3
              pkg-config
              node-gyp
            ];

            buildInputs = with pkgs; [
              vips
              vips.dev
            ];

            env = {
              ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
              npm_config_nodedir = nodejs;
              npm_config_build_from_source = "true";
            };

            npmFlags = [ "--ignore-scripts" ];

            preBuild = ''
              # Rebuild sharp against system libvips
              cd node_modules/sharp
              npm run build || node install/build.js || true
              cd ../..
            '';

            buildPhase = ''
              runHook preBuild

              npm run build
              node scripts/postbuild.js

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/lib/polkadot-desktop
              cp -r release/build/* $out/lib/polkadot-desktop/

              mkdir -p $out/bin
              makeWrapper ${electron}/bin/electron $out/bin/polkadot-desktop \
                --add-flags "$out/lib/polkadot-desktop/main.cjs"

              # Desktop entry
              mkdir -p $out/share/applications
              cat > $out/share/applications/polkadot-desktop.desktop <<'DESKTOP'
              [Desktop Entry]
              Name=Polkadot Desktop
              Exec=polkadot-desktop %U
              Terminal=false
              Type=Application
              Icon=polkadot-desktop
              Categories=Finance;
              MimeType=x-scheme-handler/polkadot;
              StartupWMClass=Polkadot Desktop
              DESKTOP

              mkdir -p $out/share/icons/hicolor/512x512/apps
              cp main/resources/icons/icon.png $out/share/icons/hicolor/512x512/apps/polkadot-desktop.png

              runHook postInstall
            '';

            dontNpmInstall = true;

            meta = with pkgs.lib; {
              description = "Polkadot Desktop application";
              license = licenses.mit;
              platforms = [
                "x86_64-linux"
                "aarch64-linux"
              ];
              mainProgram = "polkadot-desktop";
            };
          };
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24
              electron_39
            ];

            env = {
              ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
            };
          };
        }
      );
    };
}
