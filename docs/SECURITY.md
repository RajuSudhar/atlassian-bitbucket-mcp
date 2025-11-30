# Security Policy

## Package Security

This project takes security seriously. Before installing any npm package, we verify it against known compromised packages.

### Compromised Package List

We maintain vigilance against the packages listed in the Shai Hulud 2.0 attack:

- Source: [DataDog Indicators of Compromise](https://github.com/DataDog/indicators-of-compromise/blob/main/shai-hulud-2.0/consolidated_iocs.csv)
- Reference: [StepSecurity Blog - CTRL, tinycolor and 40+ npm packages compromised](https://www.stepsecurity.io/blog/ctrl-tinycolor-and-40-npm-packages-compromised)

### Before Installing Packages

1. Check the package name against the compromised list
2. Verify the package on npm registry
3. Check the package's GitHub repository
4. Review recent issues and security advisories
5. Use `npm audit` before and after installation

### Reporting Security Issues

If you discover a security vulnerability, please email [your-email] instead of using the issue tracker.

## Dependency Management

- All dependencies are reviewed before addition
- Regular `npm audit` runs
- Automated dependency updates with security review
- Minimal dependency footprint to reduce attack surface
