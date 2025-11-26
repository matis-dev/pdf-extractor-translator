import argostranslate.package
import argostranslate.translate

def install_languages():
    """
    Installs packages for English <-> Spanish, French, German.
    """
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    
    # Pairs to install: en->es, es->en, en->fr, fr->en, en->de, de->en, en->pl, pl->en
    pairs = [
        ('en', 'es'), ('es', 'en'),
        ('en', 'fr'), ('fr', 'en'),
        ('en', 'de'), ('de', 'en'),
        ('en', 'pl'), ('pl', 'en')
    ]
    
    for from_code, to_code in pairs:
        package_to_install = next(
            filter(
                lambda x: x.from_code == from_code and x.to_code == to_code, available_packages
            ), None
        )
        if package_to_install:
            print(f"Installing {from_code}->{to_code}...")
            argostranslate.package.install_from_path(package_to_install.download())

def translate_text(text, target_lang, source_lang='en'):
    """
    Translates text from source_lang to target_lang.
    """
    try:
        if source_lang == target_lang:
            return text
        return argostranslate.translate.translate(text, source_lang, target_lang)
    except Exception as e:
        print(f"Translation error: {e}")
        return text
