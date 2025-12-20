import argostranslate.package
import argostranslate.translate

def install_languages():
    """Updates the package index and installs translation models for supported languages.

    Supported pairs include English and: Spanish, French, German, Polish, 
    Portuguese, Italian, Dutch, and Russian.
    """
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    
    # Pairs to install: en <-> es, fr, de, pl, pt, it, nl, ru
    pairs = [
        ('en', 'es'), ('es', 'en'),
        ('en', 'fr'), ('fr', 'en'),
        ('en', 'de'), ('de', 'en'),
        ('en', 'pl'), ('pl', 'en'),
        ('en', 'pt'), ('pt', 'en'),
        ('en', 'it'), ('it', 'en'),
        ('en', 'nl'), ('nl', 'en'),
        ('en', 'ru'), ('ru', 'en')
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
    """Translates text between two ISO language codes using Argos Translate.

    Args:
        text (str): The string content to translate.
        target_lang (str): ISO code of the target language.
        source_lang (str): ISO code of the source language. Defaults to 'en'.

    Returns:
        str: The translated text, or the original text if translation fails.
    """
    try:
        if source_lang == target_lang:
            return text
        return argostranslate.translate.translate(text, source_lang, target_lang)
    except Exception as e:
        print(f"Translation error: {e}")
        return text

if __name__ == "__main__":
    print("Installing translation models...")
    install_languages()
    print("Translation models installed.")
